# orbit-form

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
