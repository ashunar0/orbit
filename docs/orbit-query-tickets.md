# Orbit Query — チケット一覧

設計ドキュメント: [orbit-query-design.md](./orbit-query-design.md)

## 設計方針（確定）

- React Compiler 互換: `useSyncExternalStore`、Proxy 不使用、クラスインスタンス不使用
- QueryClient はファクトリ関数 `createQueryClient()` でプレーンオブジェクト返却
- hooks 戻り値は不変（状態変更時は新しいオブジェクトを返す）
- v1 スコープ外: 楽観的更新、devtools、infinite query、codegen

---

## Phase 1: 最小限の Query ライブラリ

- [x] **OQ-01**: パッケージセットアップ — package.json 整備、tsconfig、tsdown.config.ts、`src/index.ts` エクスポート口
- [x] **OQ-02**: `createQueryClient` — キャッシュストア本体（subscribe / getSnapshot / fetchQuery / invalidate / getQueryData / setQueryData）
- [x] **OQ-03**: `QueryProvider` — React Context + `useQueryClient()` hook
- [x] **OQ-04**: `useQuery` — `useSyncExternalStore` でキャッシュ同期、`useEffect` で fetch 発火、staleTime / refetchInterval / enabled 対応
- [x] **OQ-05**: `useMutation` — mutate / isSubmitting / error、invalidate キーで自動再フェッチ、onSuccess コールバック
- [x] **OQ-06**: テスト整備 — createQueryClient / useQuery / useMutation のユニット・結合テスト（全23テスト pass）
- [x] **OQ-07**: playground 動作確認 — `apps/website` に orbit-query デモ追加（/posts ルート、useQuery + useMutation + invalidate 動作確認済み）
