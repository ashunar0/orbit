import { getContext } from "orbit-rpc";

// アプリ全体の環境変数型をここで一元定義する
// Cloudflare Workers の Bindings に合わせて拡張する
type Env = {};

export function ctx() {
  return getContext<Env>();
}
