import path from "node:path";
import type { Plugin } from "vite";
import { scanRoutes } from "./scanner";

export interface OrbitRouterConfig {
  /** routes ディレクトリのパス（デフォルト: "src/routes"） */
  routesDir?: string;
}

const VIRTUAL_MODULE_ID = "virtual:orbit-router/routes";
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

export function orbitRouter(config: OrbitRouterConfig = {}): Plugin[] {
  const routesDir = config.routesDir ?? "src/routes";
  let root: string;

  return [
    {
      name: "orbit-router:scan",
      configResolved(resolvedConfig) {
        root = resolvedConfig.root;
      },
      resolveId(id) {
        if (id === VIRTUAL_MODULE_ID) {
          return RESOLVED_VIRTUAL_MODULE_ID;
        }
      },
      async load(id) {
        if (id === RESOLVED_VIRTUAL_MODULE_ID) {
          const result = await scanRoutes(root, routesDir);
          return generateRouteModule(result);
        }
      },
      configureServer(server) {
        // ファイル追加・削除 → ルート構造が変わるので仮想モジュール再生成 + full-reload
        // NOTE: layout.tsx の export 追加・削除（loader/guard）は import * as のライブバインディングで
        //       Fast Refresh 経由で反映されるため、virtual module の再生成は不要
        const routesPath = path.resolve(root, routesDir);
        const onStructureChange = (file: string) => {
          if (!file.startsWith(routesPath)) return;
          const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
            server.ws.send({ type: "full-reload" });
          }
        };
        server.watcher.on("add", onStructureChange);
        server.watcher.on("unlink", onStructureChange);
        server.httpServer?.once("close", () => {
          server.watcher.off("add", onStructureChange);
          server.watcher.off("unlink", onStructureChange);
        });
      },
      // ファイル編集は handleHotUpdate を定義しない → Vite の Fast Refresh に任せて state を保持
    },
  ];
}

/** Windows のバックスラッシュを import パス用にスラッシュへ変換 */
function toImportPath(p: string): string {
  return p.split(path.sep).join("/");
}

function generateRouteModule({ routes, notFoundPath }: Awaited<ReturnType<typeof scanRoutes>>): string {
  const imports: string[] = [];
  const lazyDecls: string[] = [];
  const routeDefs: string[] = [];
  // layout の重複 import を防ぐ
  const layoutImportMap = new Map<string, string>();
  let layoutCounter = 0;
  // layout 階層の error.tsx import を管理
  const layoutErrorImportMap = new Map<string, string>();

  let loaderCounter = 0;
  let actionCounter = 0;
  let loadingCounter = 0;
  let errorCounter = 0;

  function getLayoutModName(layoutPath: string): string {
    let name = layoutImportMap.get(layoutPath);
    if (!name) {
      name = `LayoutMod${layoutCounter++}`;
      layoutImportMap.set(layoutPath, name);
      imports.push(`import * as ${name} from "${toImportPath(layoutPath)}";`);
    }
    return name;
  }

  function getLayoutErrorName(errorPath: string): string {
    let name = layoutErrorImportMap.get(errorPath);
    if (!name) {
      name = `LayoutError${errorCounter++}`;
      layoutErrorImportMap.set(errorPath, name);
      imports.push(`import ${name} from "${toImportPath(errorPath)}";`);
    }
    return name;
  }

  let pageModCounter = 0;

  for (const [i, route] of routes.entries()) {
    const componentName = `Route${i}`;
    const pageModName = `PageMod${pageModCounter++}`;
    imports.push(`import * as ${pageModName} from "${toImportPath(route.filePath)}";`);
    lazyDecls.push(`const ${componentName} = lazy(() => import("${toImportPath(route.filePath)}"));`);

    const layoutModNames = route.layouts.map((l) => getLayoutModName(l.layoutPath));
    const layoutEntries = route.layouts.map((l, idx) => {
      const m = layoutModNames[idx];
      let entry = `{ component: ${m}.default, loader: ${m}.loader`;
      if (l.errorPath) {
        entry += `, ErrorBoundary: ${getLayoutErrorName(l.errorPath)}`;
      }
      entry += ` }`;
      return entry;
    });
    const fields: string[] = [
      `path: "${route.path}"`,
      `component: ${componentName}`,
      `layouts: [${layoutEntries.join(", ")}]`,
      `guards: [${layoutModNames.map((m) => `${m}.guard`).join(", ")}].filter(Boolean)`,
    ];

    if (route.loaderPath) {
      const name = `loader${loaderCounter++}`;
      imports.push(`import { loader as ${name} } from "${toImportPath(route.loaderPath)}";`);
      fields.push(`loader: ${name}`);
    } else {
      // page.tsx 内に co-locate された loader をフォールバックとして使用
      fields.push(`loader: ${pageModName}.loader`);
    }

    if (route.actionPath) {
      const name = `action${actionCounter++}`;
      imports.push(`import { action as ${name} } from "${toImportPath(route.actionPath)}";`);
      fields.push(`action: ${name}`);
    } else {
      // page.tsx 内に co-locate された action をフォールバックとして使用
      fields.push(`action: ${pageModName}.action`);
    }

    if (route.loadingPath) {
      const name = `Loading${loadingCounter++}`;
      imports.push(`import ${name} from "${toImportPath(route.loadingPath)}";`);
      fields.push(`Loading: ${name}`);
    }

    if (route.errorPath) {
      const name = `ErrorBoundary${errorCounter++}`;
      imports.push(`import ${name} from "${toImportPath(route.errorPath)}";`);
      fields.push(`ErrorBoundary: ${name}`);
    }

    routeDefs.push(`  { ${fields.join(", ")} }`);
  }

  const notFoundImport = notFoundPath ? `import NotFound from "${toImportPath(notFoundPath)}";` : "";
  const notFoundExport = notFoundPath ? "export { NotFound };" : "export const NotFound = undefined;";

  return `import { lazy } from "react";
${imports.join("\n")}
${notFoundImport}

${lazyDecls.join("\n")}

export const routes = [
${routeDefs.join(",\n")}
];
${notFoundExport}
`;
}
