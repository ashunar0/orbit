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
      handleHotUpdate({ file, server }) {
        const routesPath = path.resolve(root, routesDir);
        if (file.startsWith(routesPath)) {
          const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
            server.ws.send({ type: "full-reload" });
          }
        }
      },
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

  function getLayoutName(layoutPath: string): string {
    let name = layoutImportMap.get(layoutPath);
    if (!name) {
      name = `Layout${layoutCounter++}`;
      layoutImportMap.set(layoutPath, name);
      imports.push(`import ${name} from "${toImportPath(layoutPath)}";`);
    }
    return name;
  }

  let loaderCounter = 0;
  let actionCounter = 0;
  let loadingCounter = 0;
  let errorCounter = 0;

  for (const [i, route] of routes.entries()) {
    const componentName = `Route${i}`;
    lazyDecls.push(`const ${componentName} = lazy(() => import("${toImportPath(route.filePath)}"));`);

    const layoutNames = route.layouts.map((lp) => getLayoutName(lp));
    const fields: string[] = [
      `path: "${route.path}"`,
      `component: ${componentName}`,
      `layouts: [${layoutNames.join(", ")}]`,
    ];

    if (route.loaderPath) {
      const name = `loader${loaderCounter++}`;
      imports.push(`import { loader as ${name} } from "${toImportPath(route.loaderPath)}";`);
      fields.push(`loader: ${name}`);
    }

    if (route.actionPath) {
      const name = `action${actionCounter++}`;
      imports.push(`import { action as ${name} } from "${toImportPath(route.actionPath)}";`);
      fields.push(`action: ${name}`);
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
