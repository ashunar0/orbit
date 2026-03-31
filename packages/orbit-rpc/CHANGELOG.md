# Changelog

## v1.1.0 (2026-04-01)

### Features

- `getContext()` 追加 — server.ts の関数内から Hono Context にアクセス可能に
  - Cloudflare Workers バインディング（D1, KV 等）や Cookie の読み書きに対応
  - AsyncLocalStorage ベース。関数シグネチャを汚さない pull 方式
  - プロジェクト側で `lib/context.ts` に型付きラッパーを作る推奨パターン
- dev サーバーを Hono ベースに統一 — dev/prod で同じ Hono Context が使えるように
  - Node HTTP の手書きパース（`handleRpcRequest` / `readBody`）を廃止
  - Web Standard Request/Response への変換で Hono に橋渡し

### Fixes

- dev サーバーで Zod バリデーションエラーが 500 ではなく 400 を返すように修正
- Content-Length ヘッダーによる事前サイズチェック追加（OOM 防止）
- `Set-Cookie` ヘッダーの複数値が正しく保持されるように修正
- `toWebRequest` で OPTIONS/DELETE リクエストに不要な body stream を付けないように修正

## v1.0.0 (2026-03-30)

Phase A 完了 — API 安定、セキュリティ対応完了。

### Security

- `generateHonoApp` のファイルパス文字列エスケープ追加

### Documentation

- README 新規作成（Quick Start、Zod 自動バリデーション、Hono ビルド、型フロー）

## v0.2.0 (2026-03-30)

- schema.ts の Zod スキーマによる自動バリデーション
  - `export type X = z.infer<typeof ySchema>` パターンを検出し、server.ts の関数引数と自動紐付け
  - dev middleware と本番 Hono アプリの両方で `safeParse()` を適用
  - 構造化エラーメッセージ（フィールドパス付き）を 400 で返却
- 不正 JSON / 非配列 body で 400 エラーを返却（500 ではなく）
- 引数不足時もスキーマ付き引数のバリデーションを実行
- 正規表現を括弧バランス方式に変更（デフォルト引数対応）
- schema.ts の変更も HMR で即時反映

## v0.1.0 (2026-03-30)

初回リリース。

- `orbitRpc()` Vite プラグイン — `server.ts` の関数をサーバー実行に自動変換
  - クライアント側: import を HTTP fetch スタブに差し替え
  - dev サーバー: `/rpc/*` middleware で `ssrLoadModule` 経由の関数実行
- `server.ts` スキャナ — `export function` / `export const` の両形式を検出
- 複数引数の関数に対応（引数は配列で送信、サーバー側で展開）
- void 返却の関数に対応
- リクエストボディ 1MB サイズ制限
