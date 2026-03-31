# Changelog

## v0.1.1 (2026-03-31)

### Improvements

- `main.tsx` / `app.tsx` / `env.d.ts` が不要に — プラグインが virtual module で自動生成
- CSS 探索を `src/globals.css` 規約ベースに変更（`main.tsx` パース廃止）
- `index.html` の `<script>` タグをプラグインが自動注入（手動記述不要）
- `globals.css` の `addWatchFile` 追加 — dev 中のファイル作成・削除を検知

## v0.1.0 (2026-03-31)

初回リリース。

- `orbitSSR()` Vite プラグイン — `vite.config.ts` に1行追加で SSR 有効化
- Dev モード: SSR middleware が自動注入、HMR 対応
- 本番ビルド: `vp build` で client → server の2段ビルドを自動実行
  - `dist/client/` — 静的アセット（CSS, JS + manifest）
  - `dist/server/index.js` — Cloudflare Workers エントリ（Hono アプリ）
- Client manifest からアセットタグを自動注入（`<link>`, `<script>`）
- orbit-query の dehydrate/hydrate による SSR → クライアント状態引き継ぎ
- CSS 探索: `main.tsx` の import 文から自動抽出
- orbit-rpc 統合オプション（`rpc: true`）
- XSS 防止の JSON エスケープ
