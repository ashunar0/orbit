# ルーターアーキテクチャ学習ノート

2026-03-19 のコードリーディングで学んだこと。

## Orbit Router の全体像

ルーターは **ビルド時** と **ランタイム** の2層構造。

```
ビルド時（Vite プラグイン）         ランタイム（ブラウザ）
┌──────────────────────┐       ┌──────────────────────┐
│ scanner.ts            │       │ router.tsx            │
│  routes/ を走査       │──────→│  URL を見て該当する    │
│  → ルート一覧生成     │ 仮想   │  コンポーネントを描画  │
│                       │ モジ   │                       │
│ plugin.ts             │ ュール │ link.tsx              │
│  → import文を自動生成 │       │  history.pushState    │
└──────────────────────┘       └──────────────────────┘
```

## 各ファイルの役割（5ファイル、合計300行くらい）

### 1. scanner.ts — ディレクトリ → ルート一覧

`routes/` を再帰的に歩いて `RouteEntry[]` を作る。

- `index.tsx` があるディレクトリ = ルート
- `[id]` → `:id` に変換（動的パラメータ）
- `_` 始まりのディレクトリはスキップ
- `layout.tsx` は現在のディレクトリから root まで遡って収集（外→内の順）
- 最後に静的ルートを動的ルートより前にソート

### 2. plugin.ts — Vite 仮想モジュール

scanner の結果を JavaScript コードの文字列に変換する。

```js
// こういうコードが自動生成される
import Route0 from "/path/to/routes/index.tsx";
import Layout0 from "/path/to/routes/layout.tsx";

export const routes = [
  { path: "/", component: Route0, layouts: [Layout0] }
];
```

Vite プラグインの4つのフック:
- `configResolved` — プロジェクトルートを取得
- `resolveId` — `"virtual:orbit-router/routes"` を自分が担当すると宣言
- `load` — 仮想モジュールの中身（↑の JS コード）を返す
- `handleHotUpdate` — routes/ の変更でフルリロード

`\0` プレフィックスは Rollup の規約で「実ファイルじゃないよ」の印。

### 3. match.ts — パターンマッチング

URL パスをルートパターンと比較して、動的パラメータを抽出する純粋関数。

```
matchRoute("/users/:id", "/users/123") → { params: { id: "123" } }
matchRoute("/users/:id", "/about")     → null
```

セグメント数が違えば即 null。`:` で始まるセグメントは動的パラメータとして `decodeURIComponent` して格納。

### 4. router.tsx — React の心臓部

**状態管理:**
- `useState` で `currentPath` を管理
- `useEffect` で `popstate` イベント（ブラウザの戻る/進む）を監視
- `navigate()` で `history.pushState` + `setCurrentPath`

ポイント: `pushState` だけだと React は何も知らない。`setCurrentPath` で state を更新して初めて再レンダリングが走る。

**Context:**
`currentPath`, `params`, `navigate` を Context で配布。Link や useParams がここから読む。

**レイアウトのネスト描画:**
```
layouts = [RootLayout, UsersLayout], Page = UserDetail の場合:

1. content = <Page />
2. content = <UsersLayout>{content}</UsersLayout>     ← 内側
3. content = <RootLayout>{content}</RootLayout>        ← 外側
```
逆順ループでマトリョーシカ的に組み立てる。

### 5. link.tsx — SPA ナビゲーション

普通の `<a>` タグをラップ。クリック時に:

1. **修飾キーチェック** — Cmd/Ctrl/Shift/Alt + クリックや右クリックはブラウザのデフォルト動作に任せる（新しいタブで開くとかを壊さない）
2. `preventDefault()` でページ遷移を止める
3. `navigate()` で SPA 遷移

`<a href>` を使う理由: JS が無効でも動く、右クリックメニューが自然、SEO にも有利（progressive enhancement）。

## ルーター性能の3つのレイヤー

プロダクションルーター（Next.js, React Router）との差が出るポイント。

### 1. マッチング速度

| | Orbit Router | プロダクション |
|--|-------------|-------------|
| 方式 | 線形探索 O(n) | Trie 探索 O(depth) |
| 影響 | 数百ルートまで誤差 | 数千ルートでも高速 |

→ **当面やらなくていい**。数百ルートになるまで体感差なし。

### 2. 描画コスト（一番インパクトが大きい）

| | Orbit Router | プロダクション |
|--|-------------|-------------|
| 方式 | Router 全体を再レンダリング | 差分だけ更新 |
| 例 | /users/1 → /users/2 で全部再描画 | UsersLayout はそのまま、子だけ更新 |

→ **Phase 2 の loader 設計と一緒にやる**。レイアウト単位で state を分離すれば自然に入る。

### 3. バンドルサイズ

| | Orbit Router | プロダクション |
|--|-------------|-------------|
| 方式 | 全ページ一括 static import | ページごとに dynamic import() |
| 追加機能 | なし | Link の prefetch（先読み） |

→ **Phase 2 の後**。code splitting → prefetch の順。

### インパクト順

**描画 >>> バンドル >> マッチング**

### 最適化の依存関係

```
Phase 2: loader/action 設計
  └→ 部分レンダリング（レイアウト単位の state 分離）
      └→ Code splitting（dynamic import）
          └→ Prefetch（IntersectionObserver で先読み）
              └→ Trie マッチング（必要になったら）
```

順番がある。loader がないと部分レンダリングの設計が決まらない。code splitting がないと prefetch する対象がない。
