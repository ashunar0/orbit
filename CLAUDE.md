# CLAUDE.md — Orbit Router

## プロジェクト概要

Orbit Router は Vite+ 上に構築するディレクトリベースの React ルーター。
Vite プラグインとして提供し、`routes/` にファイルを置くだけでルートが自動生成される。

## リポジトリ構成

```
orbit-router/                     Vite+ monorepo (pnpm workspace)
├── packages/orbit-router/        Vite プラグイン本体（npm パッケージ）
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
├── apps/website/                 playground（動作確認用アプリ）
│   ├── vite.config.ts            orbitRouter() + react プラグイン
│   └── src/
│       ├── main.tsx → app.tsx    React エントリ
│       └── routes/               ルーティング対象（/, /about, /users, /users/:id）
└── docs/
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
- **バリデーション**: Zod（Phase 2 で導入予定）
- **パッケージマネージャ**: pnpm（Vite+ monorepo テンプレート由来）
- **ビルド**: tsdown（`vp pack` 経由）

## 現在の状態

Phase 1（CSR-only の最小ルーター）がほぼ完了。

**完了（P1-01〜P1-12）:**
- Vite プラグインの骨格（`orbitRouter()` 関数）
- ディレクトリスキャナ（`routes/` → ルート一覧）
- 仮想モジュール（`virtual:orbit-router/routes`）
- HMR 対応（routes/ 変更で自動リロード）
- playground セットアップ
- `<Router>` コンポーネント（URL 状態管理 + ルートマッチング描画）
- `<Link>` コンポーネント（`history.pushState` による SPA ナビゲーション）
- `popstate` 対応（戻る/進むボタン）
- 動的ルートマッチング（`/users/:id` → `{ id: "123" }` 抽出）
- `useParams()` hook
- ネストレイアウト（親ディレクトリの layout.tsx を自動収集・ネスト描画）

**次にやること:**
- P1-13: playground での動作確認・デモ拡充
- P1-14: テスト整備（scanner / match / Router / Link）

→ 詳細は `docs/tickets.md` を参照。

## 設計の要点

### Vite プラグインの仕組み

1. `scanner.ts` が `routes/` を走査してルート一覧（パス + ファイルパス）を作る
2. `plugin.ts` がそれを JavaScript コード（import 文 + routes 配列）に変換
3. `virtual:orbit-router/routes` という仮想モジュールとして Vite に提供
4. アプリ側で `import { routes } from "virtual:orbit-router/routes"` で利用

### ディレクトリ規約

```
routes/page.tsx              → /
routes/layout.tsx             → ルートレイアウト
routes/about/page.tsx        → /about
routes/users/[id]/page.tsx   → /users/:id
```

- `page.tsx` = ページコンポーネント
- `layout.tsx` = レイアウト（`{children}` で子を囲む）
- `[param]` = 動的セグメント
- `_` 始まりのディレクトリはスキップ

### 将来の方針

- SSR は Cloudflare Workers 限定（adapter 層を省略してスコープ縮小）
- VoidZero の Void プラットフォームとの親和性を意識

## 既知の問題

- pre-commit hook（`vp staged`）が lint-staged 経由で動かない（Vite+ alpha のバグ）→ `.vite-hooks/pre-commit` をコメントアウト中
- `@vitejs/plugin-react` の deprecation 警告 → `@vitejs/plugin-react-oxc` に置換すれば解消
- Node.js 22+ 推奨だが、現環境は v20（動作はする）

## 注意事項

- `packages/orbit-router` を変更したら `pnpm run build` してから playground を試す
- `vp pack` 実行時に `package.json` の `exports` が自動更新される（tsdown の `exports: true` による）
