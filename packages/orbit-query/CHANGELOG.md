# Changelog

## v1.0.0 (2026-03-30)

Phase A 完了 — API 安定、セキュリティ対応完了、SSR-ready。

### Features

- `queryClient.hydrate(state)` — サーバーで取得したキャッシュをクライアントに復元。既存データがあればスキップ（クライアント優先）
- `queryClient.dehydrate()` — 成功状態のクエリをシリアライズ可能なオブジェクトに変換

### Documentation

- README に SSR Support セクション、`hydrate` / `dehydrate` API ドキュメント追加

## v0.1.2 (2026-03-30)

### Bug Fixes

- `useMutation` の `invalidate` が複数キーを個別プレフィックスとして処理するよう修正 — `invalidate: ["bookmarks", "tags"]` が1つのプレフィックスとして解釈され、どのクエリキーにもマッチしない不具合を修正

## v0.1.1 (2026-03-29)

### Security

- `invalidate` 内の `JSON.parse` を除去 — `CacheEntry` に元の `key` を保持することで、re-parse によるプロトタイプ汚染リスクを排除

### Bug Fixes

- `serializeKey` で `undefined` と `null` が同一キーに衝突する問題を修正 — sentinel 値で区別するように変更。オブジェクトキーの順序も正規化
- subscriber が 0 になったキャッシュエントリが永久に残る問題を修正 — 5分後に GC で自動削除（再 subscribe 時はタイマーキャンセル）

## v0.1.0 (2026-03-26)

初回リリース。

- `createQueryClient()` — React Compiler 互換のキャッシュストア（プレーンオブジェクト）
- `QueryProvider` / `useQueryClient()` — React Context ベースの DI
- `useQuery` — `useSyncExternalStore` ベースのデータ取得 hook
  - `staleTime` / `refetchInterval` / `enabled` オプション
  - AbortSignal 対応
- `useMutation` — 宣言的 `invalidate` キーによる自動キャッシュ無効化
- `queryOptions` パターンのサポート
- 全 23 テスト pass
