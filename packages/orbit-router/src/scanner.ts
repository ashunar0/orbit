import fs from "node:fs";
import path from "node:path";

export interface RouteEntry {
  /** URL パス（例: "/", "/users", "/users/:id"） */
  path: string;
  /** index.tsx のフルパス */
  filePath: string;
  /** layout.tsx のフルパス一覧（外側から内側の順） */
  layouts: string[];
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

  const indexFile = entries.find((e) => e.isFile() && /^index\.tsx?$/.test(e.name));

  if (indexFile) {
    const relativePath = path.relative(routesRoot, dir);
    const urlPath = dirToUrlPath(relativePath);
    const layouts = collectLayouts(dir, routesRoot);

    routes.push({
      path: urlPath,
      filePath: path.join(dir, indexFile.name),
      layouts,
    });
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith("_")) {
      await walk(path.join(dir, entry.name), routesRoot, routes);
    }
  }
}

/**
 * 現在のディレクトリから routes ルートまで遡り、layout ファイルを収集する。
 * 返却順は外側（ルート）から内側（現在のディレクトリ）。
 */
function collectLayouts(dir: string, routesRoot: string): string[] {
  const layouts: string[] = [];
  let current = dir;

  while (true) {
    const layoutPath = findLayoutFile(current);
    if (layoutPath) {
      layouts.push(layoutPath);
    }

    if (current === routesRoot) break;
    current = path.dirname(current);
  }

  // 外側（ルート）から内側の順にする
  layouts.reverse();
  return layouts;
}

function findLayoutFile(dir: string): string | undefined {
  for (const ext of [".tsx", ".ts"]) {
    const p = path.join(dir, `layout${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
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
