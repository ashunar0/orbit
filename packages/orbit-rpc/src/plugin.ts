import path from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Hono } from "hono";
import type { Plugin, ViteDevServer } from "vite";
import { contextStorage } from "./context.js";
import { scanServerModules, type ServerModule, type ServerFunction } from "./scanner.js";

export interface OrbitRpcConfig {
  /** routes ディレクトリのパス（デフォルト: "src/routes"） */
  routesDir?: string;
  /** RPC エンドポイントのプレフィックス（デフォルト: "/rpc"） */
  rpcBase?: string;
}

/**
 * Orbit RPC Vite プラグイン。
 *
 * 2つの仕事をする:
 * 1. クライアント側: server.ts の import を HTTP fetch スタブに差し替え
 * 2. dev サーバー / 本番ビルド: Hono アプリで RPC リクエストを処理
 *
 * schema.ts に Zod スキーマがあれば、自動でバリデーションを適用する。
 */
const VIRTUAL_SERVER_ID = "virtual:orbit-rpc/server";
const RESOLVED_VIRTUAL_SERVER_ID = `\0${VIRTUAL_SERVER_ID}`;

export function orbitRpc(config: OrbitRpcConfig = {}): Plugin[] {
  const routesDir = config.routesDir ?? "src/routes";
  const rpcBase = config.rpcBase ?? "/rpc";
  let root: string;
  let serverModules: ServerModule[] = [];
  let scanned = false;

  return [
    {
      name: "orbit-rpc:transform",
      configResolved(resolvedConfig) {
        root = resolvedConfig.root;
      },

      async buildStart() {
        serverModules = await scanServerModules(root, routesDir);
        scanned = true;
      },

      resolveId(id) {
        if (id === VIRTUAL_SERVER_ID) {
          return RESOLVED_VIRTUAL_SERVER_ID;
        }
      },

      async load(id) {
        if (id === RESOLVED_VIRTUAL_SERVER_ID) {
          if (!scanned) {
            serverModules = await scanServerModules(root, routesDir);
          }
          return generateHonoApp(serverModules, root, rpcBase);
        }
      },

      /**
       * server.ts ファイルがクライアント向けにロードされたとき、
       * 中身を RPC スタブ（fetch 呼び出し）に差し替える。
       */
      async transform(code, id) {
        // server.ts ファイルのみ対象
        if (!id.endsWith("/server.ts")) return null;

        const routesPath = path.resolve(root, routesDir);
        if (!id.startsWith(routesPath)) return null;

        // SSR ビルド時（サーバー側）は変換しない — 本物の関数をそのまま使う
        if (this.environment?.name === "ssr") return null;

        const mod = serverModules.find((m) => m.filePath === id);
        if (!mod) {
          // 初回スキャン後に追加された server.ts の場合、再スキャン
          serverModules = await scanServerModules(root, routesDir);
          const freshMod = serverModules.find((m) => m.filePath === id);
          if (!freshMod) return null;
          return generateClientStub(freshMod, rpcBase);
        }

        return generateClientStub(mod, rpcBase);
      },
    },
    {
      name: "orbit-rpc:dev-server",

      configureServer(server: ViteDevServer) {
        const routesPath = path.resolve(root, routesDir);

        // server.ts / schema.ts の追加・削除を監視
        const onFileChange = async (file: string) => {
          if (!file.startsWith(routesPath)) return;
          if (!file.endsWith("/server.ts") && !file.endsWith("/schema.ts")) return;
          serverModules = await scanServerModules(root, routesDir);
        };
        server.watcher.on("add", onFileChange);
        server.watcher.on("change", onFileChange);
        server.watcher.on("unlink", onFileChange);

        // dev 用 Hono アプリ（catch-all で動的にモジュールを解決）
        const devApp = createDevRpcApp(server, rpcBase, () => serverModules);

        // Vite middleware → Hono
        server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
          if (!req.url?.startsWith(rpcBase)) return next();

          try {
            const webReq = toWebRequest(req);
            const webRes = await devApp.fetch(webReq);
            await writeWebResponse(webRes, res);
          } catch (err) {
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Internal Server Error" }));
            }
          }
        });
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Client stub generation（クライアント側は変更なし）
// ---------------------------------------------------------------------------

/**
 * server.ts の中身を RPC スタブに差し替える。
 *
 * 例: routePrefix="/tasks", rpcBase="/rpc"
 *   export async function getTasks(signal) { ... }
 * → export async function getTasks(signal) {
 *     const res = await fetch("/rpc/tasks/getTasks", { method: "POST", signal });
 *     ...
 *   }
 */
function generateClientStub(mod: ServerModule, rpcBase: string): string {
  const lines: string[] = [];

  for (const fn of mod.functions) {
    const endpoint = `${rpcBase}${mod.routePrefix}/${fn.name}`;
    lines.push(`export async function ${fn.name}(...args) {`);
    lines.push(
      `  const signal = args[args.length - 1] instanceof AbortSignal ? args.pop() : undefined;`,
    );
    lines.push(`  const hasArgs = args.length > 0;`);
    lines.push(`  const res = await fetch("${endpoint}", {`);
    lines.push(`    method: "POST",`);
    lines.push(`    signal,`);
    lines.push(`    ...(hasArgs ? {`);
    lines.push(`      headers: { "Content-Type": "application/json" },`);
    lines.push(`      body: JSON.stringify(args),`);
    lines.push(`    } : {}),`);
    lines.push(`  });`);
    lines.push(`  if (!res.ok) {`);
    lines.push(`    const body = await res.json().catch(() => ({}));`);
    lines.push(`    throw new Error(body.error || \`RPC error: \${res.status}\`);`);
    lines.push(`  }`);
    lines.push(`  const text = await res.text();`);
    lines.push(`  return text ? JSON.parse(text) : undefined;`);
    lines.push(`}`);
    lines.push(``);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Dev Hono app（dev サーバー用。catch-all で ssrLoadModule を使い HMR 対応）
// ---------------------------------------------------------------------------

function createDevRpcApp(
  server: ViteDevServer,
  rpcBase: string,
  getModules: () => ServerModule[],
): Hono {
  const app = new Hono();

  app.post(`${rpcBase}/*`, async (c) => {
    // URL からモジュールと関数名を特定
    const rpcPath = c.req.path.slice(rpcBase.length);
    const lastSlash = rpcPath.lastIndexOf("/");
    if (lastSlash === -1) {
      return c.json({ error: "Invalid RPC path" }, 400);
    }

    const routePrefix = rpcPath.slice(0, lastSlash) || "";
    const functionName = decodeURIComponent(rpcPath.slice(lastSlash + 1));

    const modules = getModules();
    const mod = modules.find((m) => m.routePrefix === routePrefix);
    if (!mod) {
      return c.json({ error: `Module not found: ${routePrefix}` }, 404);
    }

    const fnDef = mod.functions.find((f: ServerFunction) => f.name === functionName);
    if (!fnDef) {
      return c.json({ error: `Function not found: ${functionName}` }, 404);
    }

    // Vite の ssrLoadModule で server.ts を動的ロード（HMR 対応）
    const serverModule = await server.ssrLoadModule(mod.filePath);
    const fn = serverModule[functionName];
    if (typeof fn !== "function") {
      return c.json({ error: `${functionName} is not a function` }, 500);
    }

    // リクエストボディを読み取り
    const body = await c.req.text();
    if (body.length > 1048576) {
      return c.json({ error: "Payload too large" }, 413);
    }

    let args: unknown[];
    try {
      args = body ? JSON.parse(body) : [];
    } catch {
      return c.json({ error: "Invalid JSON in request body" }, 400);
    }
    if (!Array.isArray(args)) {
      return c.json({ error: "Request body must be a JSON array" }, 400);
    }

    // schema.ts があれば Zod バリデーションを適用
    const validatedArgs = await validateArgs(args, fnDef, mod, (p) => server.ssrLoadModule(p));

    // contextStorage に Hono Context をセットして関数を実行
    const result = await contextStorage.run(c, () => fn(...validatedArgs));
    return c.json(result ?? null);
  });

  // catch-all 以外の不正メソッドにも 405 を返す
  app.all(`${rpcBase}/*`, (c) => c.json({ error: "Method not allowed" }, 405));

  return app;
}

// ---------------------------------------------------------------------------
// Validation（dev 用。prod はコード生成時にインライン化される）
// ---------------------------------------------------------------------------

/**
 * 各引数を対応する Zod スキーマでバリデーションする。
 * スキーマが紐付いていない引数はそのまま通す。
 */
async function validateArgs(
  args: unknown[],
  fnDef: { params: Array<{ name: string; schemaName?: string }> },
  mod: ServerModule,
  loadModule: (path: string) => Promise<Record<string, unknown>>,
): Promise<unknown[]> {
  const hasValidation = fnDef.params.some((p) => p.schemaName);
  if (!hasValidation || !mod.schemaFilePath) return args;

  const schemaModule = await loadModule(mod.schemaFilePath);

  const validated = [...args];
  for (let i = 0; i < fnDef.params.length; i++) {
    const param = fnDef.params[i];
    if (!param.schemaName) continue;

    const schema = schemaModule[param.schemaName] as
      | { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: { issues: Array<{ path: (string | number)[]; message: string }> } } }
      | undefined;
    if (schema && typeof schema.safeParse === "function") {
      const result = schema.safeParse(args[i]);
      if (!result.success) {
        const issues = result.error!.issues
          .map((issue) =>
            issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
          )
          .join(", ");
        throw new RpcValidationError(`Validation error on "${param.name}": ${issues}`);
      }
      validated[i] = result.data;
    }
  }

  return validated;
}

class RpcValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Production Hono app generation（contextStorage.run 対応）
// ---------------------------------------------------------------------------

/**
 * 本番用 Hono アプリのコードを生成する。
 *
 * import app from "virtual:orbit-rpc/server" で使える。
 * Cloudflare Workers の場合は export default app; するだけ。
 *
 * schema.ts に Zod スキーマがあれば、.parse() によるバリデーションを含む。
 */
function generateHonoApp(modules: ServerModule[], root: string, rpcBase: string): string {
  const lines: string[] = [];

  lines.push(`import { Hono } from "hono";`);
  lines.push(`import { contextStorage } from "orbit-rpc";`);
  lines.push(``);

  // server.ts と schema.ts を import
  const validModules: Array<[number, ServerModule]> = [];
  for (const [i, mod] of modules.entries()) {
    if (mod.routePrefix.includes(":")) {
      console.warn(
        `[orbit-rpc] Dynamic route prefix "${mod.routePrefix}" is not supported for RPC. Skipping.`,
      );
      continue;
    }
    validModules.push([i, mod]);
    const importPath = mod.filePath.split(path.sep).join("/").replace(/[\\"]/g, "\\$&");
    lines.push(`import * as mod${i} from "${importPath}";`);

    if (mod.schemaFilePath) {
      const schemaPath = mod.schemaFilePath.split(path.sep).join("/").replace(/[\\"]/g, "\\$&");
      lines.push(`import * as schema${i} from "${schemaPath}";`);
    }
  }

  lines.push(``);
  lines.push(`const app = new Hono();`);
  lines.push(``);

  // 各関数を Hono ルートとして登録
  for (const [i, mod] of validModules) {
    for (const fn of mod.functions) {
      const endpoint = `${rpcBase}${mod.routePrefix}/${fn.name}`;
      lines.push(`app.post("${endpoint}", async (c) => {`);
      lines.push(`  try {`);
      lines.push(`    const body = await c.req.text();`);
      lines.push(
        `    if (body.length > 1048576) return c.json({ error: "Payload too large" }, 413);`,
      );
      lines.push(`    let args;`);
      lines.push(
        `    try { args = body ? JSON.parse(body) : []; } catch { return c.json({ error: "Invalid JSON in request body" }, 400); }`,
      );
      lines.push(
        `    if (!Array.isArray(args)) return c.json({ error: "Request body must be a JSON array" }, 400);`,
      );

      // Zod バリデーション: スキーマが紐付いた引数を検証
      if (mod.schemaFilePath) {
        for (let pi = 0; pi < fn.params.length; pi++) {
          const param = fn.params[pi];
          if (param.schemaName) {
            lines.push(`    {`);
            lines.push(`      const r = schema${i}.${param.schemaName}.safeParse(args[${pi}]);`);
            lines.push(
              `      if (!r.success) { const msg = r.error.issues.map(i => i.path.length ? i.path.join(".") + ": " + i.message : i.message).join(", "); return c.json({ error: "Validation error on \\"${param.name}\\": " + msg }, 400); }`,
            );
            lines.push(`      args[${pi}] = r.data;`);
            lines.push(`    }`);
          }
        }
      }

      // contextStorage.run で Hono Context をセットして関数を実行
      lines.push(
        `    const result = await contextStorage.run(c, () => mod${i}.${fn.name}(...args));`,
      );
      lines.push(`    return c.json(result ?? null);`);
      lines.push(`  } catch (err) {`);
      lines.push(`    console.error(err);`);
      lines.push(`    return c.json({ error: "Internal Server Error" }, 500);`);
      lines.push(`  }`);
      lines.push(`});`);
      lines.push(``);
    }
  }

  lines.push(`export default app;`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Node HTTP ↔ Web Standard 変換
// ---------------------------------------------------------------------------

/**
 * Node.js IncomingMessage → Web Standard Request に変換する。
 * Vite の connect middleware から Hono に橋渡しするために使う。
 */
function toWebRequest(nodeReq: IncomingMessage): Request {
  const url = new URL(nodeReq.url!, `http://${nodeReq.headers.host || "localhost"}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeReq.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const hasBody = nodeReq.method !== "GET" && nodeReq.method !== "HEAD";
  return new Request(url, {
    method: nodeReq.method,
    headers,
    ...(hasBody
      ? {
          body: Readable.toWeb(nodeReq) as ReadableStream,
          // @ts-expect-error -- duplex is required for streaming request bodies (Node 18+)
          duplex: "half",
        }
      : {}),
  });
}

/**
 * Web Standard Response → Node.js ServerResponse に書き戻す。
 */
async function writeWebResponse(webRes: Response, nodeRes: ServerResponse): Promise<void> {
  nodeRes.statusCode = webRes.status;
  for (const [key, value] of webRes.headers) {
    nodeRes.setHeader(key, value);
  }
  const body = await webRes.arrayBuffer();
  nodeRes.end(Buffer.from(body));
}
