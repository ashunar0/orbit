# Changelog

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
