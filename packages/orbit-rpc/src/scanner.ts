import fs from "node:fs";
import path from "node:path";

export interface ServerFunction {
  /** 関数名（例: "getTasks"） */
  name: string;
}

export interface ServerModule {
  /** server.ts のフル��ス */
  filePath: string;
  /** URL プレフィックス（例: "/tasks", "/users/:id"） */
  routePrefix: string;
  /** エクスポートされた関数一覧 */
  functions: ServerFunction[];
}

/**
 * routes ディレクトリから server.ts ファイルをスキャンし、
 * エクスポートされた関数名を抽出する。
 */
export async function scanServerModules(
  root: string,
  routesDir: string,
): Promise<ServerModule[]> {
  const absoluteRoutesDir = path.resolve(root, routesDir);

  if (!fs.existsSync(absoluteRoutesDir)) {
    return [];
  }

  const modules: ServerModule[] = [];
  await walk(absoluteRoutesDir, absoluteRoutesDir, modules);
  return modules;
}

async function walk(
  dir: string,
  routesRoot: string,
  modules: ServerModule[],
): Promise<void> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  const serverFile = entries.find(
    (e) => e.isFile() && /^server\.ts$/.test(e.name),
  );

  if (serverFile) {
    const filePath = path.join(dir, serverFile.name);
    const relativePath = path.relative(routesRoot, dir);
    const routePrefix = dirToRoutePrefix(relativePath);
    const functions = extractExportedFunctions(filePath);

    if (functions.length > 0) {
      modules.push({ filePath, routePrefix, functions });
    }
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith("_")) {
      await walk(path.join(dir, entry.name), routesRoot, modules);
    }
  }
}

/**
 * server.ts から export された関数名を抽出する。
 * 簡易パース（正規表現ベース）。
 */
function extractExportedFunctions(filePath: string): ServerFunction[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const functions: ServerFunction[] = [];

  // export async function name / export function name
  for (const match of content.matchAll(
    /export\s+(?:async\s+)?function\s+(\w+)/g,
  )) {
    functions.push({ name: match[1] });
  }

  // export const name = async (...) => / export const name = function
  for (const match of content.matchAll(
    /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function\b)/g,
  )) {
    if (!functions.some((f) => f.name === match[1])) {
      functions.push({ name: match[1] });
    }
  }

  return functions;
}

/**
 * ディレクトリの相対パスをルートプレフィックスに変換する。
 *  ""           → ""
 *  "tasks"      → "/tasks"
 *  "users/[id]" ��� "/users/:id"
 */
function dirToRoutePrefix(relativePath: string): string {
  if (relativePath === "") return "";

  const segments = relativePath
    .split(path.sep)
    .filter((seg) => !/^\(.+\)$/.test(seg))
    .map((seg) => {
      const match = seg.match(/^\[(.+)]$/);
      return match ? `:${match[1]}` : seg;
    });

  return segments.length === 0 ? "" : `/${segments.join("/")}`;
}
