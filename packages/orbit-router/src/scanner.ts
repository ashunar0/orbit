import fs from "node:fs";
import path from "node:path";

export interface RouteEntry {
  /** URL パス（例: "/", "/users", "/users/:id"） */
  path: string;
  /** index.tsx のフルパス */
  filePath: string;
  /** layout.tsx のフルパス（存在する場合） */
  layoutPath?: string;
}

/**
 * routes ディレクトリをスキャンしてルート定義を生成する。
 *
 * 規約:
 *   routes/index.tsx       → /
 *   routes/users/index.tsx → /users
 *   routes/users/[id]/index.tsx → /users/:id
 */
export async function scanRoutes(root: string, routesDir: string): Promise<RouteEntry[]> {
  const absoluteRoutesDir = path.resolve(root, routesDir);

  if (!fs.existsSync(absoluteRoutesDir)) {
    return [];
  }

  const routes: RouteEntry[] = [];
  await walk(absoluteRoutesDir, absoluteRoutesDir, routes);

  // 静的ルートを動的ルートより先に（"/users" が "/users/:id" より前）
  routes.sort((a, b) => {
    const aSegments = a.path.split("/").length;
    const bSegments = b.path.split("/").length;
    if (aSegments !== bSegments) return aSegments - bSegments;
    const aDynamic = a.path.includes(":") ? 1 : 0;
    const bDynamic = b.path.includes(":") ? 1 : 0;
    return aDynamic - bDynamic;
  });

  return routes;
}

async function walk(dir: string, routesRoot: string, routes: RouteEntry[]): Promise<void> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  const hasIndex = entries.some((e) => e.isFile() && /^index\.tsx?$/.test(e.name));

  if (hasIndex) {
    const relativePath = path.relative(routesRoot, dir);
    const urlPath = dirToUrlPath(relativePath);
    const indexFile = entries.find((e) => e.isFile() && /^index\.tsx?$/.test(e.name))!;
    const layoutFile = entries.find((e) => e.isFile() && /^layout\.tsx?$/.test(e.name));

    routes.push({
      path: urlPath,
      filePath: path.join(dir, indexFile.name),
      layoutPath: layoutFile ? path.join(dir, layoutFile.name) : undefined,
    });
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith("_")) {
      await walk(path.join(dir, entry.name), routesRoot, routes);
    }
  }
}

/**
 * ディレクトリの相対パスを URL パスに変換する。
 *  ""           → "/"
 *  "users"      → "/users"
 *  "users/[id]" → "/users/:id"
 */
function dirToUrlPath(relativePath: string): string {
  if (relativePath === "") return "/";

  const segments = relativePath.split(path.sep).map((seg) => {
    // [id] → :id
    const match = seg.match(/^\[(.+)]$/);
    return match ? `:${match[1]}` : seg;
  });

  return `/${segments.join("/")}`;
}
