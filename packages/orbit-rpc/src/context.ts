import { AsyncLocalStorage } from "node:async_hooks";
import type { Context } from "hono";

export const contextStorage = new AsyncLocalStorage<Context>();

/**
 * アプリ側で環境変数の型を登録するためのインターフェース。
 *
 * ```ts
 * // src/lib/context.ts
 * declare module "orbit-rpc" {
 *   interface Register {
 *     env: { DB: D1Database; ADMIN_PASSWORD: string };
 *   }
 * }
 * ```
 */
export interface Register {
  // env: { DB: D1Database; ... } — アプリ側で declare module で上書きする
}

/** Register.env が登録済みなら使い、未登録なら Record<string, unknown> にフォールバック */
type RegisteredEnv = Register extends { env: infer T } ? T : Record<string, unknown>;

/**
 * RPC ハンドラ内で Hono Context を取得する。
 *
 * server.ts の関数内から呼ぶと、現在のリクエストに紐づく Hono Context が返る。
 * Cloudflare Workers のバインディング（D1, KV 等）や Cookie へのアクセスに使う。
 *
 * ```ts
 * // src/lib/context.ts で型を1回宣言すれば:
 * declare module "orbit-rpc" {
 *   interface Register { env: { DB: D1Database } }
 * }
 *
 * // server.ts では型パラメータ不要で使える:
 * import { getContext } from "orbit-rpc";
 * const c = getContext();
 * c.env.DB // ← 型補完が効く
 * ```
 */
export function getContext<
  E extends Record<string, unknown> = RegisteredEnv,
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
