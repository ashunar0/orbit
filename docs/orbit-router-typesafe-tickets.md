# Orbit Router Phase 3 — 型安全化チケット

設計方針: Vite プラグインがルートスキャン結果から TypeScript 型定義を自動生成し、`useParams`・`Link`・`useNavigate`・`LoaderArgs` に型安全性を提供する。

---

## Phase 3: 型安全化

- [ ] **P3-01**: ルート型定義の自動生成
  - 概要: `plugin.ts` の `generateRouteModule()` を拡張し、ルートパスのリテラルユニオン型とルートごとの params 型を `.d.ts` として生成する
  - 例: `"/users/:id"` → `type RouteParams["/users/:id"] = { id: string }`
  - 完了条件: `virtual:orbit-router/routes` の型定義にルートパス一覧と params マッピングが含まれる
  - 依存: なし

- [ ] **P3-02**: `useParams()` の型安全化
  - 概要: `useParams()` がジェネリクスまたはルート情報からパラメータの型を推論できるようにする
  - 完了条件: `routes/users/[id]/page.tsx` 内で `useParams()` が `{ id: string }` を返し、`params.typo` が型エラーになる
  - 依存: P3-01

- [ ] **P3-03**: `<Link>` の型安全化
  - 概要: `href` prop を有効なルートパスのリテラルユニオン型に制約する。動的ルートのパラメータ埋め込みも型安全に
  - 完了条件: `<Link href="/typo">` が型エラー、`<Link href="/users/123">` が通る
  - 依存: P3-01

- [ ] **P3-04**: `useNavigate()` の型安全化
  - 概要: `useNavigate()` の引数を有効なルートパスに制約する
  - 完了条件: `navigate("/typo")` が型エラーになる
  - 依存: P3-01

- [ ] **P3-05**: `LoaderArgs` / `ActionArgs` の params 型安全化
  - 概要: `LoaderArgs.params` をルートごとの params 型にする。ジェネリクスまたは別アプローチで
  - 完了条件: `/users/[id]/loader.ts` 内で `params.id` が `string` に推論され、`params.typo` が型エラーになる
  - 依存: P3-01

- [ ] **P3-06**: テスト整備
  - 概要: 型生成のユニットテスト + playground での型チェック確認
  - 完了条件: 型生成テスト pass、`pnpm typecheck` で playground がエラーなし
  - 依存: P3-01 〜 P3-05

- [ ] **P3-07**: playground 動作確認 + ドキュメント更新
  - 概要: playground で型安全な API を実際に使うデモ。README に型安全機能を追記
  - 完了条件: playground が型安全な useParams / Link を使用、README 更新済み
  - 依存: P3-06
