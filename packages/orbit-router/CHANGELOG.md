# Changelog

## 0.1.10 (2026-03-23)

### Features

- `redirect()` が内部で throw するように変更 — 呼び出し側の `throw` が不要に
  - guard / loader / action すべてで `redirect("/path")` だけで遷移できる
  - action の catch で `isRedirectError` を拾いナビゲーション実行
  - action redirect 時の `navigationState` リセット漏れも修正

### Breaking Changes

- `redirect()` の戻り値が `RedirectError` → `never` に変更
  - 既存の `throw redirect(...)` はランタイムでは動作するが、TypeScript が unreachable code 警告を出す
  - `throw` を削除して `redirect(...)` に書き換えてください

## 0.1.9 (2026-03-23)

### Features

- `LoaderArgs` / `ActionArgs<TData>` ヘルパー型を追加
  - `action` の `data` 型をジェネリクスで指定できるように
  - インラインの型注釈が不要に
  - 内部型定義も統一

## 0.1.8 (2026-03-16)

### Bug Fixes

- HMR watcher のリスナークリーンアップと routesPath キャッシュ
- HMR をファイル編集時 Fast Refresh に切り替え state を保持

## 0.1.0 (unreleased)

### Features

- File-based routing with `page.tsx` / `layout.tsx` conventions
- Dynamic routes via `[param]` directory naming
- Nested layouts with automatic collection
- Type-safe loaders (`loader.ts`) and actions (`action.ts`)
- `loading.tsx` / `error.tsx` per-route UI states
- `not-found.tsx` for custom 404 pages
- Code splitting with `React.lazy` for page components
- Link prefetch on hover for instant navigation
- `useParams()`, `useLoaderData()`, `useActionData()`, `useSubmit()`
- `useSearchParams()` with optional Zod validation
- `useNavigation()` for loading/submitting state
- `useNavigate()` for programmatic navigation
- Context split (state/dispatch) for optimal re-render performance
- HMR support for route file changes
