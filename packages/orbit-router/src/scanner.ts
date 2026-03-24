import fs from "node:fs";
import path from "node:path";

export interface LayoutInfo {
  /** layout.tsx のフルパス */
  layoutPath: string;
  /** 同ディレクトリの error.tsx のフルパス（存在する場合） */
  errorPath?: string;
}

export interface RouteEntry {
  /** URL パス（例: "/", "/users", "/users/:id"） */
  path: string;
  /** page.tsx のフルパス */
  filePath: string;
  /** layout 情報一覧（外側から内側の順） */
  layouts: LayoutInfo[];
  /** loader.ts のフルパス（存在する場合） */
  loaderPath?: string;
  /** action.ts のフルパス（存在する場合） */
  actionPath?: string;
  /** loading.tsx のフルパス（存在する場合） */
  loadingPath?: string;
  /** error.tsx のフルパス（存在する場合） */
  errorPath?: string;
}

export interface ScanResult {
  routes: RouteEntry[];
  /** routes ルートの not-found.tsx パス（存在する場合） */
  notFoundPath?: string;
}

/**
 * routes ディレクトリをスキャンしてルート定義を生成する。
 *
 * 規約:
 *   routes/page.tsx       → /
 *   routes/users/page.tsx → /users
 *   routes/users/[id]/page.tsx → /users/:id
 */
export async function scanRoutes(root: string, routesDir: string): Promise<ScanResult> {
  const absoluteRoutesDir = path.resolve(root, routesDir);

  if (!fs.existsSync(absoluteRoutesDir)) {
    return { routes: [] };
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

  const notFoundPath = findFile(absoluteRoutesDir, "not-found");

  return { routes, notFoundPath };
}

async function walk(dir: string, routesRoot: string, routes: RouteEntry[]): Promise<void> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  const pageFile = entries.find((e) => e.isFile() && /^page\.tsx?$/.test(e.name));

  if (pageFile) {
    const relativePath = path.relative(routesRoot, dir);
    const urlPath = dirToUrlPath(relativePath);
    const layouts = collectLayouts(dir, routesRoot, dir);

    const entry: RouteEntry = {
      path: urlPath,
      filePath: path.join(dir, pageFile.name),
      layouts,
    };

    const loaderFile = findFile(dir, "loader");
    if (loaderFile) entry.loaderPath = loaderFile;

    const actionFile = findFile(dir, "action");
    if (actionFile) entry.actionPath = actionFile;

    const loadingFile = findFile(dir, "loading");
    if (loadingFile) entry.loadingPath = loadingFile;

    const errorFile = findFile(dir, "error");
    if (errorFile) entry.errorPath = errorFile;

    routes.push(entry);
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith("_")) {
      await walk(path.join(dir, entry.name), routesRoot, routes);
    }
  }
}

/**
 * 現在のディレクトリから routes ルートまで遡り、layout ファイルと error ファイルを収集する。
 * 返却順は外側（ルート）から内側（現在のディレクトリ）。
 *
 * pageDir と同ディレクトリの error.tsx は page 専属（RouteEntry.errorPath）なので
 * LayoutInfo には含めない。これにより同じ error.tsx が二重登録されるのを防ぐ。
 */
function collectLayouts(dir: string, routesRoot: string, pageDir: string): LayoutInfo[] {
  const layouts: LayoutInfo[] = [];
  let current = dir;

  while (true) {
    const layoutPath = findFile(current, "layout");
    if (layoutPath) {
      const info: LayoutInfo = { layoutPath };
      // page と同ディレクトリの error.tsx は page 側で管理するのでスキップ
      if (current !== pageDir) {
        const errorPath = findFile(current, "error");
        if (errorPath) info.errorPath = errorPath;
      }
      layouts.push(info);
    }

    if (current === routesRoot) break;
    current = path.dirname(current);
  }

  // 外側（ルート）から内側の順にする
  layouts.reverse();
  return layouts;
}

function findFile(dir: string, name: string): string | undefined {
  for (const ext of [".tsx", ".ts"]) {
    const p = path.join(dir, `${name}${ext}`);
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

  const segments = relativePath
    .split(path.sep)
    .filter((seg) => !/^\(.+\)$/.test(seg)) // (group) → URL に含めない
    .map((seg) => {
      // [id] → :id
      const match = seg.match(/^\[(.+)]$/);
      return match ? `:${match[1]}` : seg;
    });

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}
