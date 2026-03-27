# Changelog

## 0.1.18 (2026-03-27)

### Features

- `useSearchParams()` が `[search, setSearch]` タプルを返すように変更
- `setSearch({ key: value })` で URL クエリパラメータをマージ更新
- `setSearch({ key: null })` でパラメータを削除
- `replace: true` オプションで `history.replaceState` を使用可能

### Refactor

- `setSearchParams` を dispatch context に移動し、`useNavigate` / `useSubmit` と同じ安定参照パターンに統一（React Compiler 互換）

### Breaking Changes

- `useSearchParams()` の戻り値が値から `[値, setter]` タプルに変更

## 0.1.17 (2026-03-26)

### Features

- ルート型定義の自動生成 — Vite プラグインが `.orbit/route-types.d.ts` をプロジェクトに書き出す
- `useParams<"/users/:id">()` — ルートパスを型引数に渡すと `{ id: string }` が推論される
- `<Link href>` の型安全化 — 有効なルートパスのみ受け付ける（`"/typo"` は型エラー）
- `useNavigate()` の型安全化 — 同上
- `LoaderArgs<"/users/:id">` / `ActionArgs` — params がルートごとに型付き
- 型引数は全てオプショナル — 省略時は従来の `string` / `Record<string, string>` にフォールバック

### Bug Fixes

- 型生成時のルートパスインジェクション防止（安全な文字のみ許可）

## 0.1.16 (2026-03-24)

### Bug Fixes

- layout loader エラー時に失敗した layout 自体をレンダリングしないように修正
  - layout loader が throw した場合、その layout と子 layout をスキップしてエラー表示のみレンダリング
  - page エラーは全 layout をラップ、layout[i] エラーは 0..i-1 のみ、guard エラーは layout なし

## 0.1.15 (2026-03-24)

### Features

- error.tsx のバブリングと Router レベルの `ErrorFallback` を実装
  - error.tsx がないルートでエラーが発生した場合、最も近い親ルートの error.tsx まで自動バブルアップ
  - layout ディレクトリにも error.tsx を配置可能に（Next.js App Router と同じ挙動）
  - `<Router ErrorFallback={...} />` prop で最外殻のフォールバックを指定可能
  - どの error.tsx にもキャッチされない場合に白画面を防止

### Bug Fixes

- ErrorBoundary を layout の内側に配置し、layout 自身ではなく children のエラーのみキャッチするように修正
- loader エラーのバブリングで失敗した階層（`ErrorOrigin`）を追跡し、正しい ErrorBoundary から探索開始
- page と同ディレクトリの error.tsx が layout 側にも二重登録される問題を修正
- plugin の `errorCounter` 宣言順を修正（TDZ リスク解消）

## 0.1.14 (2026-03-23)

### Features

- loader / guard の引数に `signal: AbortSignal` を追加
  - `fetch("/api", { signal })` のように渡すことでナビゲーション中断時にリクエストもキャンセル可能
  - StrictMode での二重実行時、1回目の fetch が自動的にキャンセルされる
  - pending navigation, 初回ロード, action 後の revalidation, prefetch すべてで対応

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
