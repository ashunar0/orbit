# Orbit Router — 要件定義

## プロジェクト概要

Orbit.js は Vite+ 上に構築する convention ベースの React フレームワーク。
orbit-router はその最初のパッケージで、ディレクトリベースのルーティングを提供する Vite プラグイン。

## コンセプト

**「TanStack Router の型安全思想 + Next.js App Router のディレクトリ規約 + Zod 標準 + Vite+ 基盤」**

## ゴール

### Phase 1: CSR-only の最小ルーター（MVP）

ブラウザだけで動くディレクトリベースルーターを完成させる。

**ユーザーから見た体験:**

1. `vite.config.ts` に `orbitRouter()` を追加する
2. `src/routes/` にファイルを置くだけでルートが生える
3. `<Link to="/about">` で SPA ナビゲーションできる
4. `layout.tsx` でレイアウトがネストされる
5. `/users/[id]` で動的ルートが使える

**技術要件:**

| 機能                 | 説明                                                              |
| -------------------- | ----------------------------------------------------------------- |
| ディレクトリスキャン | `routes/` を再帰的に走査し、`page.tsx` をルートとして認識         |
| 仮想モジュール       | `virtual:orbit-router/routes` でルート設定をアプリに提供          |
| `<Router>`           | URL 状態を管理し、マッチするルートを描画する React コンポーネント |
| `<Link>`             | `history.pushState` による SPA ナビゲーション                     |
| popstate 対応        | ブラウザの戻る/進むボタンで正しく遷移                             |
| 動的ルート           | `[id]` → `:id` のパスパラメータ解決                               |
| `useParams()`        | 動的ルートのパラメータを取得する hooks                            |
| レイアウトネスト     | 親 `layout.tsx` が子ルートを `{children}` で囲む                  |
| HMR 対応             | `routes/` 内のファイル変更で自動リロード                          |

### Phase 2: 型安全なデータフェッチ

| 機能              | 説明                                                |
| ----------------- | --------------------------------------------------- |
| `loader` パターン | ルートごとのデータ取得関数                          |
| `action` パターン | フォーム送信等のミューテーション                    |
| Zod Search Params | URL クエリパラメータの型安全なバリデーション        |
| `useLoaderData()` | loader の戻り値を型推論付きで取得                   |
| `useSearch()`     | Zod スキーマから推論された型で Search Params を取得 |
| `loading.tsx`     | データ取得中のローディング UI                       |
| `error.tsx`       | エラー時のフォールバック UI                         |
| 型の自動推論      | params → loader → component まで型が一本で繋がる    |

### Phase 3: Cloudflare 限定 SSR（将来）

| 機能           | 説明                                              |
| -------------- | ------------------------------------------------- |
| SSR            | Cloudflare Workers 上でサーバーサイドレンダリング |
| ストリーミング | `ReadableStream` によるストリーミング SSR         |
| Void 統合      | VoidZero の Void プラットフォームとの連携         |

### Phase 4: RSC 対応（将来）

| 機能                    | 説明                                                |
| ----------------------- | --------------------------------------------------- |
| RSC                     | `react-server-dom-*` による React Server Components |
| `"use client"` 自動検知 | ディレクティブ不要の DX                             |

## 技術スタック

| レイヤー           | 技術                                     |
| ------------------ | ---------------------------------------- |
| ツールチェーン     | Vite+（Rolldown, Oxlint, Oxfmt, Vitest） |
| ルーティング       | orbit-router（自作）                     |
| バリデーション     | Zod                                      |
| UI                 | React 19+                                |
| デプロイ先（将来） | Cloudflare Workers（Void）               |

## リポジトリ構成

```
orbit-router/                  # Vite+ monorepo
├── packages/orbit-router/     # Vite プラグイン（npm パッケージ）
│   └── src/
│       ├── index.ts           エクスポート口
│       ├── plugin.ts          Vite プラグイン（仮想モジュール生成）
│       ├── scanner.ts         routes/ ディレクトリスキャナ
│       └── client.d.ts        仮想モジュールの型定義
├── apps/website/              # playground（動作確認用アプリ）
│   ├── vite.config.ts         orbitRouter() を使用
│   └── src/
│       ├── main.tsx           エントリポイント
│       ├── app.tsx            ルーター動作確認
│       └── routes/            ルーティング対象ディレクトリ
└── docs/                      # ドキュメント
```

## 設計判断の記録

| 日付       | 判断                     | 理由                                                           |
| ---------- | ------------------------ | -------------------------------------------------------------- |
| 2026-03-07 | Zod を標準バリデーション | AI 生成精度が高い・エコシステムで広く使われている              |
| 2026-03-13 | Vinxi → Vite+ に変更     | Vite+ が品質層まで統合・Orbit は convention layer に集中できる |
| 2026-03-19 | SSR は Cloudflare 限定   | adapter 層が不要になり実装スコープが大幅に縮小                 |
| 2026-03-19 | モノレポ構成             | プラグイン本体と playground を並走開発                         |
