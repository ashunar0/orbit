import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { scanServerModules, type ServerModule } from "./scanner";

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
 * 2. dev サーバー: /rpc/* リクエストを受けて server.ts の関数を実行
 */
export function orbitRpc(config: OrbitRpcConfig = {}): Plugin[] {
  const routesDir = config.routesDir ?? "src/routes";
  const rpcBase = config.rpcBase ?? "/rpc";
  let root: string;
  let serverModules: ServerModule[] = [];

  return [
    {
      name: "orbit-rpc:transform",
      configResolved(resolvedConfig) {
        root = resolvedConfig.root;
      },

      async buildStart() {
        serverModules = await scanServerModules(root, routesDir);
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

        // server.ts の追加・削除を監視
        const onFileChange = async (file: string) => {
          if (!file.startsWith(routesPath)) return;
          if (!file.endsWith("/server.ts")) return;
          serverModules = await scanServerModules(root, routesDir);
        };
        server.watcher.on("add", onFileChange);
        server.watcher.on("unlink", onFileChange);

        // RPC リクエストハンドラ
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith(rpcBase)) return next();

          try {
            const result = await handleRpcRequest(
              server,
              req,
              rpcBase,
              serverModules,
            );
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Internal Server Error";
            const status = err instanceof RpcError ? err.status : 500;
            res.statusCode = status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: message }));
          }
        });
      },
    },
  ];
}

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
    lines.push(`  const signal = args[args.length - 1] instanceof AbortSignal ? args.pop() : undefined;`);
    lines.push(`  const hasInput = args.length > 0;`);
    lines.push(`  const res = await fetch("${endpoint}", {`);
    lines.push(`    method: "POST",`);
    lines.push(`    signal,`);
    lines.push(`    ...(hasInput ? {`);
    lines.push(`      headers: { "Content-Type": "application/json" },`);
    lines.push(`      body: JSON.stringify(args[0]),`);
    lines.push(`    } : {}),`);
    lines.push(`  });`);
    lines.push(`  if (!res.ok) {`);
    lines.push(`    const body = await res.json().catch(() => ({}));`);
    lines.push(`    throw new Error(body.error || \`RPC error: \${res.status}\`);`);
    lines.push(`  }`);
    lines.push(`  return res.json();`);
    lines.push(`}`);
    lines.push(``);
  }

  return lines.join("\n");
}

class RpcError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * dev サーバーで RPC リクエストを処理する。
 *
 * URL: POST /rpc/{routePrefix}/{functionName}
 * Body: JSON（関数の引数）
 */
async function handleRpcRequest(
  server: ViteDevServer,
  req: { url?: string; method?: string } & NodeJS.ReadableStream,
  rpcBase: string,
  modules: ServerModule[],
): Promise<unknown> {
  if (req.method !== "POST") {
    throw new RpcError("Method not allowed", 405);
  }

  // URL からモジュールと関数名を特定
  const rpcPath = req.url!.slice(rpcBase.length); // "/tasks/getTasks"
  const lastSlash = rpcPath.lastIndexOf("/");
  if (lastSlash === -1) {
    throw new RpcError("Invalid RPC path", 400);
  }

  const routePrefix = rpcPath.slice(0, lastSlash) || "";
  const functionName = rpcPath.slice(lastSlash + 1);

  const mod = modules.find((m) => m.routePrefix === routePrefix);
  if (!mod) {
    throw new RpcError(`Module not found: ${routePrefix}`, 404);
  }

  const fnDef = mod.functions.find((f) => f.name === functionName);
  if (!fnDef) {
    throw new RpcError(`Function not found: ${functionName}`, 404);
  }

  // Vite の ssrLoadModule で server.ts を動的ロード（HMR 対応）
  const serverModule = await server.ssrLoadModule(mod.filePath);
  const fn = serverModule[functionName];

  if (typeof fn !== "function") {
    throw new RpcError(`${functionName} is not a function`, 500);
  }

  // リクエストボディを読み取り
  const body = await readBody(req);
  const input = body ? JSON.parse(body) : undefined;

  // 関数実行
  return input !== undefined ? fn(input) : fn();
}

function readBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
