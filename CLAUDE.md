# CLAUDE.md — Orbit

## 設計思想（実装時に常に意識すること）

詳細は `docs/philosophy.md` を参照。以下は判断に迷ったとき立ち返る原則。

### AI が書いて、人間が読む

- **読みやすさ > 書きやすさ**。短さのために処理を隠さない
- **コードを自然言語に翻訳できるか？** — これが読みやすさの判定基準
- **正しい書き方は1つ** — API の自由度を絞り、AI の出力を収束させる
- **理解負債をゼロに** — AI がどれだけ書いても、人間がその場で理解できる状態を保つ

### 実装の判断基準

- **隠すな、揃えろ** — Rails 的な「短いけど裏で何が起きてるかわからない」を避ける。Hono 的な「展開済みで明示的」を目指す
- **規約は道標であって壁ではない** — デフォルトはシンプルで読みやすく。逸れることは禁止しない
- **React Compiler 互換** — `useSyncExternalStore`、Proxy 不使用、クラスインスタンス不使用、hooks 戻り値の不変性
- **YAGNI** — 必要になるまで作らない

## プロジェクト概要

Orbit は React のためのフロントエンドツールキット。
ルーティング・データ取得・フォームを、一貫した規約と型安全で統合する。

ターゲット：AI と一緒に開発する個人開発者・小規模チーム。

| パッケージ | 説明 | 状態 |
|-----------|------|------|
| `orbit-router` | ディレクトリベースルーター | v0.1.17 |
| `orbit-query` | データ取得 + キャッシュ | v0.1.0 |
| `orbit-form` | React Compiler 互換フォーム | 名前確保済み、計画中 |

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
├── packages/orbit-query/         データ取得 + キャッシュ（実装準備中）
├── packages/orbit-form/          フォームライブラリ（計画中）
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
    ├── requirements.md           要件定義
    └── tickets.md                チケット一覧
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
- **バリデーション**: Zod
- **パッケージマネージャ**: pnpm（Vite+ monorepo テンプレート由来）
- **ビルド**: tsdown（`vp pack` 経由）

## ロードマップ

- [x] **Phase 1** — orbit-router（CSR ルーター）
- [ ] **Phase 2** — orbit-query 実装
- [ ] **Phase 3** — orbit-router 型安全化（typed params, typed links, typed search params）
- [ ] **Phase 4** — orbit-form 実装

## ディレクトリ規約

```
routes/page.tsx              → /
routes/layout.tsx            → ルートレイアウト
routes/about/page.tsx        → /about
routes/users/[id]/page.tsx   → /users/:id
```

- `page.tsx` = ページコンポーネント
- `layout.tsx` = レイアウト（`{children}` で子を囲む）
- `loader.ts` = データ取得
- `action.ts` = フォーム送信処理
- `guard.ts` = アクセス制御
- `error.tsx` = エラー境界（親へ自動バブリング）
- `loading.tsx` = ローディング状態
- `not-found.tsx` = 404 ページ
- `[param]` = 動的セグメント
- `_` 始まりのディレクトリはスキップ

## 既知の問題

- pre-commit hook（`vp staged`）が lint-staged 経由で動かない（Vite+ alpha のバグ）→ `.vite-hooks/pre-commit` をコメントアウト中
- `@vitejs/plugin-react` の deprecation 警告 → `@vitejs/plugin-react-oxc` に置換すれば解消
- Node.js 22+ 推奨だが、現環境は v20（動作はする）

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
