# orbit-form

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
