# Changelog

## v0.1.0 (2026-03-30)

初回リリース。

- `orbitRpc()` Vite プラグイン — `server.ts` の関数をサーバー実行に自動変換
  - クライアント側: import を HTTP fetch スタブに差し替え
  - dev サーバー: `/rpc/*` middleware で `ssrLoadModule` 経由の関数実行
- `server.ts` スキャナ — `export function` / `export const` の両形式を検出
- 複数引数の関数に対応（引数は配列で送信、サーバー側で展開）
- void 返却の関数に対応
- リクエストボディ 1MB サイズ制限
