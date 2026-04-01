# orbit-form

## 1.1.0 (2026-04-01)

### Features

- `setError()` API 追加 — サーバー起因のエラー（認証失敗等）をフィールドに紐付けて表示可能に
  - `form.setError("password", "パスワードが違います")` でフィールド単位
  - `form.setError("_root", "サーバーに接続できません")` でフォーム全体
  - 既存の `fieldError()` / `errors._root` でそのまま表示できる

## 1.0.0 (2026-03-30)

Phase A 完了 — API 安定、セキュリティ対応完了。

### Security

- `setValue` に `__proto__` / `constructor` / `prototype` キーガード追加
- `shallowEqual` を plain object のみに制限（non-plain object は常に `false`）

## 0.1.6 (2026-03-29)

### Bug Fixes

- `useForm` の `defaultValues` が動的ルート遷移時に追従しない問題を修正。shallow equal で実質的な変更を検出し `resetAll` するように変更（例: `/issues/1` → `/issues/2` でフォームが古い値のまま残るバグ）

## 0.1.5 (2026-03-28)

### Features

- `useForm()` の返り値に `setValue()` を追加 — Select, DatePicker 等の非 input コンポーネントと型安全に連携可能に
  - `form.setValue("status", "done")` で Zod スキーマから推論された型がそのまま効く
  - `store?.setValue()` 経由の null チェック＋型キャストが不要に

## 0.1.4 (2026-03-28)

### Bug Fixes

- `useForm` の `defaultValues` にインラインオブジェクトを渡すと無限ループする問題を修正。defaultValues は初回確定時（undefined → 値）だけ読み、以降は無視するように変更

## 0.1.3 (2026-03-28)

### Features

- `register()` メソッドを追加 — `<input {...form.register("title")} />` でフィールドを型安全にバインド。React Context 越しの generics 問題を回避
- `fieldError()` メソッドを追加 — `form.fieldError("title")` でフィールドエラーを取得

### Bug Fixes

- `onSubmit` の戻り値型を `void | Promise<unknown>` に緩和 — `useMutation` の `mutate` を直接渡せるように

## 0.1.2 (2026-03-28)

### Bug Fixes

- `<Field>` に `form` prop を追加 — `<Field form={form} name="title">` で型推論が効くように。React Context 経由では generics が伝播しない問題の解決策
- `onSubmit` の戻り値型を `void | Promise<unknown>` に緩和 — `useMutation` の `mutate` を直接渡せるように

## 0.1.1 (2026-03-28)

### Bug Fixes

- `useForm` の型推論を改善 — Zod スキーマから TInput/TOutput を正しく推論するように変更。`Record<string, unknown>` に fallback する問題を修正
- `<Form>` が `className` 等の HTML form 属性を受け付けるように `FormProps` を拡張

## 0.1.0 (2026-03-27)

Phase 1 実装 — 個人開発規模（~30フィールド）を完璧にカバー。

### Features

- `createFormStore()` — React 非依存の外部ストア（ファクトリパターン）
- `useForm()` — Zod スキーマ統合、非同期 defaultValues 対応
- `useField()` — `useSyncExternalStore` によるフィールド単位の細粒度購読
- `<Form>` / `<Field>` — FormContext ベースのコンポーネント（render props）
- `dependencies` — フィールド間の宣言的な依存ルール（useEffect + setValue 撲滅）
- Zod `transform` / `refine` 完全対応（型変換 + クロスフィールドバリデーション）

### Design Principles

- React Compiler 互換（useSyncExternalStore、Proxy 不使用、不変な戻り値）
- Zod が validation / transform / type inference の single source of truth
- フィールド単位の購読で、他フィールドの変更による不要な再レンダリングを防止
