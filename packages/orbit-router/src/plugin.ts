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

  for (const [i, route] of routes.entries()) {
    const componentName = `Route${i}`;
    imports.push(`import ${componentName} from "${route.filePath}";`);

    const hasLayout = route.layoutPath != null;
    if (hasLayout) {
      const layoutName = `Layout${i}`;
      imports.push(`import ${layoutName} from "${route.layoutPath}";`);
      routeDefs.push(
        `  { path: "${route.path}", component: ${componentName}, layout: ${layoutName} }`,
      );
    } else {
      routeDefs.push(`  { path: "${route.path}", component: ${componentName} }`);
    }
  }

  return `${imports.join("\n")}

export const routes = [
${routeDefs.join(",\n")}
];
`;
}
