# CLAUDE.md — Orbit

## 設計思想（実装時に常に意識すること）

詳細は `docs/philosophy.md` を参照。以下は判断に迷ったとき立ち返る原則。

### 核心: 人間の最終責任

- **読みやすさ > 書きやすさ** — コードの最終責任は人間にある。読めて判断できる状態を維持する
- **コードを自然言語に翻訳できるか？** — これが読みやすさの判定基準
- **正しい書き方は1つ** — API の自由度を絞り、AI の出力を収束させる
- **理解負債をゼロに** — AI がどれだけ書いても、人間がその場で理解できる状態を保つ

### 実装の判断基準

- **隠すな、階層化しろ** — WHAT（何をしているか）はコードに見える状態にする。HOW（どう実現しているか）は抽象化してよいが、境界を明示する（例: `server.ts` というファイル名が境界）
- **規約は道標であって壁ではない** — デフォルトはシンプルで読みやすく。逸れることは禁止しない
- **React Compiler 前提** — `useSyncExternalStore`、Proxy 不使用、クラスインスタンス不使用、hooks 戻り値の不変性。`useCallback` / `useMemo` / `React.memo` は書かない（React Compiler が自動メモ化する）
- **YAGNI** — 必要になるまで作らない

## プロジェクト概要

Orbit は React のためのフロントエンドツールキット。
ルーティング・データ取得・フォームを、一貫した規約と型安全で統合する。

ターゲット：AI と一緒に開発する個人開発者・小規模チーム。

| パッケージ     | 説明                        | 状態   |
| -------------- | --------------------------- | ------ |
| `orbit-router` | ディレクトリベースルーター  | v1.0.0 |
| `orbit-query`  | データ取得 + キャッシュ     | v1.0.0 |
| `orbit-form`   | React Compiler 互換フォーム | v1.0.0 |
| `orbit-rpc`    | server.ts → Hono RPC 変換   | v1.0.0 |
| `orbit-ssr-plugin` | SSR + Cloudflare Workers ビルド | v0.1.0 |

## リポジトリ構成

```
orbit/                            Vite+ monorepo (pnpm workspace)
├── packages/orbit-router/        Vite プラグイン + ランタイム（npm パッケージ）
│   └── src/
│       ├── index.ts              エクスポート口
│       ├── plugin.ts             Vite プラグイン（仮想モジュール生成）
│       ├── scanner.ts            routes/ ディレクトリスキャナ
│       ├── client.d.ts           virtual module の型定義
│       └── runtime/              クライアントサイドランタイム
│           ├── router.tsx        <Router> コンポーネント + RouterContext
│           ├── link.tsx          <Link> コンポーネント（SPA ナビゲーション）
│           ├── match.ts          ルートマッチング（動的パラメータ対応）
│           └── hooks.ts          useParams() 等の hooks
├── packages/orbit-query/         データ取得 + キャッシュ
├── packages/orbit-form/          フォームライブラリ
├── packages/orbit-rpc/           server.ts → Hono RPC 変換（Vite プラグイン）
│   └── src/
│       ├── index.ts              エクスポート口
│       ├── plugin.ts             Vite プラグイン（スタブ変換 + dev middleware + Hono アプリ生成）
│       └── scanner.ts            server.ts スキャナ
├── packages/orbit-ssr/           SSR Vite プラグイン（npm 名: orbit-ssr-plugin）
│   └── src/
│       ├── index.ts              エクスポート口
│       └── plugin.ts             Vite プラグイン（dev SSR middleware + Workers ビルド）
├── apps/website/                 playground（動作確認用アプリ）
│   ├── vite.config.ts            orbitRouter() + react プラグイン
│   └── src/
│       ├── main.tsx → app.tsx    React エントリ
│       └── routes/               ルーティング対象
└── docs/
    ├── philosophy.md             設計思想
    ├── orbit-query-design.md     orbit-query 設計ドキュメント
    ├── orbit-form-design.md      orbit-form 設計ドキュメント
    ├── file-conventions.md       ファイル規約（page/hooks/server/schema）
    ├── architecture.md           アーキテクチャ解説
    ├── rpc-design.md             orbit-rpc 設計ドキュメント
    ├── v1-roadmap.md             v1.0 ロードマップ & 残課題
    ├── blog/                     ブログ記事ドラフト
    ├── notes/                    思想の深掘りメモ
    └── archive/                  過去ドキュメント（requirements.md, tickets.md 等）
```

## コマンド

```bash
# 依存インストール（ルートで実行）
pnpm install

# orbit-router パッケージのビルド
cd packages/orbit-router && pnpm run build

# playground 起動（http://localhost:5173）
cd apps/website && pnpm run dev

# 型チェック・リント
vp check

# テスト
cd packages/orbit-router && pnpm run test
```

## 技術スタック

- **ツールチェーン**: Vite+ v0.1.12（alpha）— Rolldown, Oxlint, Oxfmt, Vitest
- **UI**: React 19
- **サーバー**: Hono（RPC ルート生成先）
- **バリデーション**: Zod
- **パッケージマネージャ**: pnpm（Vite+ monorepo テンプレート由来）
- **ビルド**: tsdown（`vp pack` 経由）

## ロードマップ

- [x] **Phase 1** — orbit-router（CSR ルーター）
- [x] **Phase 2** — orbit-query 実装
- [x] **Phase 3** — orbit-router 型安全化（typed params, typed links, typed search params）
- [x] **Phase 4** — orbit-form 実装
- [x] **Phase 5** — アーキテクチャ検証（Todoist クローンで実証。orbit-form の API 改善、Router 型定義修正、React Compiler 互換確認）
- [x] **Phase 6** — orbit-rpc 実装（server.ts → Hono RPC 自動変換、Cloudflare Workers 対応）
- [x] **Phase 7** — orbit-ssr-plugin 実装（dev SSR + Cloudflare Workers 本番ビルド）

## ディレクトリ規約

```
routes/page.tsx              → /
routes/layout.tsx            → ルートレイアウト
routes/about/page.tsx        → /about
routes/users/[id]/page.tsx   → /users/:id
```

- `page.tsx` = ページコンポーネント（「目次」として読めること）
- `hooks.ts` = カスタムフック（1フック1関心事。名前で意図が伝わる）
- `server.ts` = サーバー側のデータアクセス関数（RPC スタイル。ただの関数を export する）
- `schema.ts` = Zod スキーマ + 型定義
- `layout.tsx` = レイアウト（`{children}` で子を囲む。データ取得しない）
- `guard.ts` = アクセス制御
- `error.tsx` = エラー境界（親へ自動バブリング）
- `loading.tsx` = ローディング状態
- `not-found.tsx` = 404 ページ
- `[param]` = 動的セグメント
- `_` 始まりのディレクトリはスキップ

### ファイル間のデータフロー

```
server.ts  → データアクセス関数（getTasks, createTask 等）
hooks.ts   → useQuery / useMutation でラップ（useTasks, useCreateTask 等）
page.tsx   → hooks を呼んで JSX を書く（目次）
schema.ts  → searchParams / フォームの型とバリデーション
```

### page.tsx のデータフロー

```tsx
// page.tsx — 上から下に読めば処理フローがわかる
const [search, setSearch] = useSearchParams(searchSchema); // State
const { data: tasks } = useTasks(); // Fetch
const filtered = useTaskFilter(tasks, search.q); // Transform
const { mutate: toggle } = useToggleTask(); // Mutate
return <div>...</div>; // Render
```

### orbit-form の使い方

```tsx
// hooks.ts — useForm でスキーマとデフォルト値を渡す
export function useCreateTaskForm() {
  return useForm({ schema: taskCreateSchema, defaultValues: { title: "", priority: "medium" } })
}

// page.tsx — register でフィールドをバインド
const form = useCreateTaskForm()
const { mutate: create } = useCreateTask()

<Form form={form} onSubmit={create}>
  <input {...form.register("title")} />
  {form.fieldError("title") && <p>{form.fieldError("title")}</p>}
</Form>
```

**注意: `<Field>` コンポーネントは使わない。`form.register()` を使う。**

## 既知の問題

- pre-commit hook（`vp staged`）が lint-staged 経由で動かない（Vite+ alpha のバグ）→ `.vite-hooks/pre-commit` をコメントアウト中
- `@vitejs/plugin-react` の deprecation 警告 → `@vitejs/plugin-react-oxc` に置換すれば解消
- Node.js 22.12.0+ 必須（`engines` で指定済み）

## リリース時のルール

- バージョンアップ（publish）したら必ず各パッケージの `CHANGELOG.md` にパッチノートを記録する
- 忘れずに同じコミットか直後のコミットで追加すること

## npm publish 手順

```bash
cd packages/orbit-router && pnpm publish --no-git-checks
```

- **必ず `pnpm publish` を使う**（`npm publish` は不可）
  - pnpm が `catalog:` プロトコルを実バージョンに解決してから tarball を作る
  - `npm publish` だと `"zod": "catalog:"` がそのまま publish されて壊れる
- `tsdown.config.ts` の `exports: false` を維持すること
  - `true` にすると `vp pack` が `package.json` の `exports` を上書きし、手動設定した `types` 条件や `./client` エントリが消える
- アプリ側で `virtual:orbit-router/routes` の型を使うには、tsconfig.json か エントリファイルに以下を追加：
  ```ts
  /// <reference types="orbit-router/client" />
  ```

## 注意事項

- `packages/orbit-router` を変更したら `pnpm run build` してから playground を試す
