import fs from "node:fs";
import path from "node:path";

export interface FunctionParam {
  /** 引数名（例: "input"） */
  name: string;
  /** 型名（例: "TaskForm"）。不明な場合は undefined */
  typeName?: string;
  /** 対応する Zod スキーマの export 名（例: "taskFormSchema"）。schema.ts になければ undefined */
  schemaName?: string;
}

export interface ServerFunction {
  /** 関数名（例: "getTasks"） */
  name: string;
  /** 引数リスト（型情報付き） */
  params: FunctionParam[];
}

export interface ServerModule {
  /** server.ts のフルパス */
  filePath: string;
  /** 対応する schema.ts のフルパス（存在しない場合は undefined） */
  schemaFilePath?: string;
  /** URL プレフィックス（例: "/tasks", "/users/:id"） */
  routePrefix: string;
  /** エクスポートされた関数一覧 */
  functions: ServerFunction[];
}

/**
 * routes ディレクトリから server.ts ファイルをスキャンし、
 * エクスポートされた関数名と引数の型情報を抽出する。
 * 隣接する schema.ts があれば Zod スキーマとの対応も解決する。
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

    // schema.ts が隣接しているか確認
    const schemaPath = path.join(dir, "schema.ts");
    const hasSchema = entries.some(
      (e) => e.isFile() && e.name === "schema.ts",
    );

    // schema.ts から型名→スキーマ名のマップを構築
    const schemaMap = hasSchema
      ? extractSchemaMap(schemaPath)
      : new Map<string, string>();

    // server.ts から関数を抽出（引数の型情報付き）
    const functions = extractExportedFunctions(filePath, schemaMap);

    if (functions.length > 0) {
      modules.push({
        filePath,
        schemaFilePath: hasSchema ? schemaPath : undefined,
        routePrefix,
        functions,
      });
    }
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith("_")) {
      await walk(path.join(dir, entry.name), routesRoot, modules);
    }
  }
}

/**
 * schema.ts から「型名 → Zod スキーマ名」のマップを抽出する。
 *
 * 認識するパターン:
 *   export type TaskForm = z.infer<typeof taskFormSchema>;
 *   → Map { "TaskForm" => "taskFormSchema" }
 */
function extractSchemaMap(filePath: string): Map<string, string> {
  const content = fs.readFileSync(filePath, "utf-8");
  const map = new Map<string, string>();

  // export type X = z.infer<typeof ySchema>
  for (const match of content.matchAll(
    /export\s+type\s+(\w+)\s*=\s*z\.infer\s*<\s*typeof\s+(\w+)\s*>/g,
  )) {
    map.set(match[1], match[2]);
  }

  return map;
}

/**
 * server.ts から export された関数を抽出する。
 * 各引数の型名を解析し、schemaMap にマッチすれば schemaName を紐付ける。
 */
function extractExportedFunctions(
  filePath: string,
  schemaMap: Map<string, string>,
): ServerFunction[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const functions: ServerFunction[] = [];

  // export async function name(...) / export function name(...)
  // 括弧のネストに対応するため、関数名の位置を見つけてから引数部分を抽出
  for (const match of content.matchAll(
    /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g,
  )) {
    const name = match[1];
    if (functions.some((f) => f.name === name)) continue;

    const paramsStr = extractBalancedParens(content, match.index! + match[0].length - 1);
    const params = parseParams(paramsStr, schemaMap);
    functions.push({ name, params });
  }

  // export const name = async (...) => / export const name = (...)  =>
  for (const match of content.matchAll(
    /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
  )) {
    const name = match[1];
    if (functions.some((f) => f.name === name)) continue;

    const paramsStr = extractBalancedParens(content, match.index! + match[0].length - 1);
    const params = parseParams(paramsStr, schemaMap);
    functions.push({ name, params });
  }

  return functions;
}

/**
 * 開き括弧の位置から対応する閉じ括弧までの中身を返す。
 * ネストされた括弧（デフォルト引数内の関数呼び出し等）に対応。
 */
function extractBalancedParens(content: string, openIndex: number): string {
  if (content[openIndex] !== "(") return "";

  let depth = 0;
  for (let i = openIndex; i < content.length; i++) {
    if (content[i] === "(") depth++;
    else if (content[i] === ")") {
      depth--;
      if (depth === 0) {
        return content.slice(openIndex + 1, i);
      }
    }
  }

  // 閉じ括弧が見つからない場合（構文エラー）
  return "";
}

/**
 * 関数の引数文字列をパースして FunctionParam 配列にする。
 * デフォルト値内のカンマやネストに対応するため、括弧の深さを追跡する。
 *
 * 例: "input: TaskForm, signal?: AbortSignal"
 * → [{ name: "input", typeName: "TaskForm", schemaName: "taskFormSchema" },
 *    { name: "signal", typeName: "AbortSignal" }]
 */
function parseParams(
  paramsStr: string,
  schemaMap: Map<string, string>,
): FunctionParam[] {
  if (!paramsStr.trim()) return [];

  // カンマで分割するが、括弧内のカンマは無視する
  const parts = splitTopLevelCommas(paramsStr);
  const params: FunctionParam[] = [];

  for (const part of parts) {
    // デフォルト値を除去: "name: Type = defaultValue" → "name: Type"
    const withoutDefault = part.replace(/\s*=\s*[\s\S]*$/, "").trim();
    if (!withoutDefault) continue;

    // name?: Type or name: Type
    const paramMatch = withoutDefault.match(/^(\w+)\??\s*:\s*(\w+)/);
    if (paramMatch) {
      const name = paramMatch[1];
      const typeName = paramMatch[2];
      const schemaName = schemaMap.get(typeName);
      params.push({ name, typeName, schemaName });
    } else {
      // 型注釈がない場合（例: destructuring など）
      const nameOnly = withoutDefault.match(/^(\w+)/);
      if (nameOnly) {
        params.push({ name: nameOnly[1] });
      }
    }
  }

  return params;
}

/**
 * トップレベルのカンマで文字列を分割する。
 * 括弧 (), {}, <> 内のカンマは分割しない。
 */
function splitTopLevelCommas(str: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const ch of str) {
    if (ch === "(" || ch === "{" || ch === "<") {
      depth++;
      current += ch;
    } else if (ch === ")" || ch === "}" || ch === ">") {
      depth--;
      current += ch;
    } else if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}

/**
 * ディレクトリの相対パスをルートプレフィックスに変換する。
 *  ""           → ""
 *  "tasks"      → "/tasks"
 *  "users/[id]" → "/users/:id"
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
