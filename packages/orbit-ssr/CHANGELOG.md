# Changelog

## v0.1.0 (2026-03-31)

初回リリース。

- `orbitSSR()` Vite プラグイン — `vite.config.ts` に1行追加で SSR 有効化
- Dev モード: SSR middleware が自動注入、HMR 対応
- 本番ビルド: `vp build` で client → server の2段ビルドを自動実行
  - `dist/client/` — 静的アセット（CSS, JS + manifest）
  - `dist/server/index.js` — Cloudflare Workers エントリ（Hono アプリ）
- Client manifest からアセットタグを自動注入（`<link>`, `<script>`）
- orbit-query の dehydrate/hydrate による SSR → クライアント状態引き継ぎ
- CSS import を main.tsx から自動抽出して client entry に含める
- orbit-rpc 統合オプション（`rpc: true`）
- XSS 防止の JSON エスケープ
