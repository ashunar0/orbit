import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { scanRoutes, type RouteEntry } from "./scanner";

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
          await writeRouteTypes(root, result.routes);
          return generateRouteModule(result);
        }
      },
      configureServer(server) {
        // ファイル追加・削除 → ルート構造が変わるので仮想モジュール再生成 + full-reload
        // NOTE: guard.ts の追加・削除はファイル構造の変更なので watcher が検出し再生成される
        const routesPath = path.resolve(root, routesDir);
        const onStructureChange = async (file: string) => {
          if (!file.startsWith(routesPath)) return;
          // ルート構造変更時に型定義も再生成
          const result = await scanRoutes(root, routesDir);
          await writeRouteTypes(root, result.routes);
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
  // guard.ts import を管理
  const guardImportMap = new Map<string, string>();
  let guardCounter = 0;

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

  function getGuardName(guardPath: string): string {
    let name = guardImportMap.get(guardPath);
    if (!name) {
      name = `Guard${guardCounter++}`;
      guardImportMap.set(guardPath, name);
      imports.push(`import ${name} from "${toImportPath(guardPath)}";`);
    }
    return name;
  }

  for (const [i, route] of routes.entries()) {
    const componentName = `Route${i}`;
    lazyDecls.push(`const ${componentName} = lazy(() => import("${toImportPath(route.filePath)}"));`);

    const layoutModNames = route.layouts.map((l) => getLayoutModName(l.layoutPath));
    const layoutEntries = route.layouts.map((l, idx) => {
      const m = layoutModNames[idx];
      let entry = `{ component: ${m}.default`;
      if (l.errorPath) {
        entry += `, ErrorBoundary: ${getLayoutErrorName(l.errorPath)}`;
      }
      entry += ` }`;
      return entry;
    });
    const guardNames = route.layouts
      .filter((l) => l.guardPath)
      .map((l) => getGuardName(l.guardPath!));
    const fields: string[] = [
      `path: "${route.path}"`,
      `component: ${componentName}`,
      `layouts: [${layoutEntries.join(", ")}]`,
      `guards: [${guardNames.join(", ")}]`,
    ];

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

/**
 * ルートパスから動的パラメータ名を抽出する。
 * 例: "/users/:id/posts/:postId" → ["id", "postId"]
 */
export function extractParams(routePath: string): string[] {
  const params: string[] = [];
  for (const match of routePath.matchAll(/:(\w+)/g)) {
    params.push(match[1]);
  }
  return params;
}

/**
 * ルート情報から TypeScript 型定義の文字列を生成する。
 * テスト可能にするためファイル書き込みと分離。
 */
const SAFE_PATH = /^[/a-zA-Z0-9_:.-]+$/;

export function generateRouteTypesContent(routes: RouteEntry[]): string {
  for (const route of routes) {
    if (!SAFE_PATH.test(route.path)) {
      throw new Error(`Unsafe route path detected: ${route.path}`);
    }
  }

  const lines: string[] = [
    "// このファイルは orbit-router が自動生成します。手動で編集しないでください。",
    "",
    'import "orbit-router";',
    "",
  ];

  // RoutePaths — 全ルートパスのリテラルユニオン
  const pathLiterals = routes.map((r) => `  | "${r.path}"`);
  lines.push("export type RoutePaths =");
  if (pathLiterals.length > 0) {
    lines.push(pathLiterals.join("\n") + ";");
  } else {
    lines.push("  never;");
  }
  lines.push("");

  // RouteParams — ルートパスごとの params マッピング
  lines.push("export interface RouteParams {");
  for (const route of routes) {
    const params = extractParams(route.path);
    if (params.length > 0) {
      const fields = params.map((p) => `${p}: string`).join("; ");
      lines.push(`  "${route.path}": { ${fields} };`);
    } else {
      lines.push(`  "${route.path}": Record<string, never>;`);
    }
  }
  lines.push("}")
  lines.push("");

  // orbit-router モジュールの型を拡張
  lines.push('declare module "orbit-router" {');
  lines.push("  interface Register {");
  lines.push("    routePaths: RoutePaths;");
  lines.push("    routeParams: RouteParams;");
  lines.push("  }");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * ルート情報から TypeScript 型定義を生成し、.orbit/route-types.d.ts に書き出す。
 */
async function writeRouteTypes(root: string, routes: RouteEntry[]): Promise<void> {
  const outDir = path.join(root, ".orbit");
  await fs.promises.mkdir(outDir, { recursive: true });

  const content = generateRouteTypesContent(routes);
  const filePath = path.join(outDir, "route-types.d.ts");

  // 内容が同じなら書き込みスキップ（不要な HMR を防ぐ）
  try {
    const existing = await fs.promises.readFile(filePath, "utf-8");
    if (existing === content) return;
  } catch {
    // ファイルが存在しない場合は書き込む
  }

  await fs.promises.writeFile(filePath, content);
}
