# Changelog

## 0.1.13 (2026-03-23)

### Bug Fixes

- guard があるルートで prefetch キャッシュが無効化される問題を修正
  - guard の有無に関係なく、guard 通過後に prefetch キャッシュを確認するように変更
  - キャッシュヒット時は loader の再実行をスキップし即コミットする

## 0.1.12 (2026-03-23)

### Bug Fixes

- `page.tsx` 内に co-locate された `loader` / `action` が認識されない問題を修正
  - `layout.tsx` では `import *` で全 export を読むため co-locate した loader が動作していたが、`page.tsx` では別ファイル (`loader.ts`) のみ検出する仕様だった
  - page も `import * as PageMod` で静的 import し、別ファイルがない場合は `PageMod.loader` / `PageMod.action` をフォールバックとして使用するように統一
  - 別ファイル (`loader.ts` / `action.ts`) がある場合はそちらが優先される（従来通り）

## 0.1.11 (2026-03-23)

### Features

- `useLayoutData()` hook を追加 — page から直近の親 layout の loader データを取得可能に
- README を全面更新 — layout loader, redirect, Form, 型ヘルパーのドキュメントを追加

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
