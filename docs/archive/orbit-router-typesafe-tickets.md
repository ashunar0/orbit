# Orbit Router Phase 3 — 型安全化チケット

設計方針: Vite プラグインがルートスキャン結果から TypeScript 型定義を自動生成し、`useParams`・`Link`・`useNavigate`・`LoaderArgs` に型安全性を提供する。

---

## Phase 3: 型安全化

- [x] **P3-01**: ルート型定義の自動生成
  - 概要: `plugin.ts` の `generateRouteModule()` を拡張し、ルートパスのリテラルユニオン型とルートごとの params 型を `.d.ts` として生成する
  - 例: `"/users/:id"` → `type RouteParams["/users/:id"] = { id: string }`
  - 完了条件: `virtual:orbit-router/routes` の型定義にルートパス一覧と params マッピングが含まれる

- [x] **P3-02**: `useParams()` の型安全化
  - 概要: `useParams<"/users/:id">()` → `{ id: string }` が推論される
  - 完了条件: `params.typo` が型エラーになる

- [x] **P3-03**: `<Link>` の型安全化
  - 概要: `href` prop を `ValidHref` 型に制約。動的ルートは `"/users/${string}"` を受け付ける
  - 完了条件: `<Link href="/typo">` が型エラー、`<Link href="/users/123">` が通る

- [x] **P3-04**: `useNavigate()` の型安全化
  - 概要: `useNavigate()` の引数を `ValidHref` に制約
  - 完了条件: `navigate("/typo")` が型エラーになる

- [x] **P3-05**: `LoaderArgs` / `ActionArgs` の params 型安全化
  - 概要: `LoaderArgs<"/users/:id">` → `params: { id: string }` が推論される
  - 完了条件: `params.typo` が型エラーになる

- [x] **P3-06**: テスト整備（全71テスト pass）
  - 概要: extractParams / generateRouteTypesContent のユニットテスト 8 件追加
  - 完了条件: 型生成テスト pass

- [x] **P3-07**: playground 動作確認 + ドキュメント更新
  - 概要: playground で型安全な useParams / LoaderArgs を使用。README に型安全機能を追記
  - 完了条件: playground が型安全 API を使用、README 更新済み
