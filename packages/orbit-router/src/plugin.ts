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
          const routes = await scanRoutes(root, routesDir);
          return generateRouteModule(routes);
        }
      },
      handleHotUpdate({ file, server }) {
        const routesPath = `${root}/${routesDir}`;
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

function generateRouteModule(routes: Awaited<ReturnType<typeof scanRoutes>>): string {
  const imports: string[] = [];
  const routeDefs: string[] = [];
  // layout の重複 import を防ぐ
  const layoutImportMap = new Map<string, string>();
  let layoutCounter = 0;

  function getLayoutName(layoutPath: string): string {
    let name = layoutImportMap.get(layoutPath);
    if (!name) {
      name = `Layout${layoutCounter++}`;
      layoutImportMap.set(layoutPath, name);
      imports.push(`import ${name} from "${layoutPath}";`);
    }
    return name;
  }

  for (const [i, route] of routes.entries()) {
    const componentName = `Route${i}`;
    imports.push(`import ${componentName} from "${route.filePath}";`);

    const layoutNames = route.layouts.map((lp) => getLayoutName(lp));

    if (layoutNames.length > 0) {
      routeDefs.push(
        `  { path: "${route.path}", component: ${componentName}, layouts: [${layoutNames.join(", ")}] }`,
      );
    } else {
      routeDefs.push(`  { path: "${route.path}", component: ${componentName}, layouts: [] }`);
    }
  }

  return `${imports.join("\n")}

export const routes = [
${routeDefs.join(",\n")}
];
`;
}
