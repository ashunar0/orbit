import { AsyncLocalStorage } from "node:async_hooks";
import type { Context } from "hono";

export const contextStorage = new AsyncLocalStorage<Context>();

/**
 * RPC ハンドラ内で Hono Context を取得する。
 *
 * server.ts の関数内から呼ぶと、現在のリクエストに紐づく Hono Context が返る。
 * Cloudflare Workers のバインディング（D1, KV 等）や Cookie へのアクセスに使う。
 *
 * @example
 * ```ts
 * import { getContext } from "orbit-rpc";
 *
 * export async function getArticles() {
 *   const c = getContext<{ DB: D1Database }>();
 *   return c.env.DB.prepare("SELECT * FROM articles").all();
 * }
 * ```
 */
export function getContext<
  E extends Record<string, unknown> = Record<string, unknown>,
>(): Context<{ Bindings: E }> {
  const ctx = contextStorage.getStore();
  if (!ctx) {
    throw new Error(
      "getContext() must be called within an RPC handler. " +
        "Make sure you are calling it inside a function exported from server.ts.",
    );
  }
  return ctx as Context<{ Bindings: E }>;
}
