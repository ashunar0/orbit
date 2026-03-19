# React ルーターを300行で自作する — Orbit Router 開発記 #1

## はじめに

Next.js の App Router が好きだ。ディレクトリを切るだけでルートになる。レイアウトも自然にネストされる。

ただ、Next.js の外でこの体験を得ようとすると、選択肢が意外とない。TanStack Router はファイルベース（`routes/users.tsx` とフラットに並べるスタイル）で、ディレクトリベースとはちょっと違う。

**ディレクトリ構造 = URL 構造** になる、軽量なルーターが欲しい。それなら作ろう。

Orbit という、AI 駆動開発のための規約を作るプロジェクトをやっていて、このルーターはその一部品だ。基盤には Vite+ (VoidZero) を使っている。

思想的に近いのは SvelteKit だと思う。ディレクトリ規約で Vite プラグインとして動く、という構造がほぼ同じだ。今後 loader/action を入れると Remix 色が、Zod を入れると TanStack Router 色が出てくる予定。

今回は Phase 1 として、CSR のみの最小ルーターを作った。コア約300行。この記事ではその中身を解説する。

---

## 全体のアーキテクチャ — ビルド時とランタイムの2層構造

Orbit Router は2つのレイヤーで動いている。

<!-- TODO: Excalidraw で図を作成して画像を貼る。構成イメージ:
  左: ビルド時（Vite プラグイン）— scanner.ts + plugin.ts
  右: ランタイム（ブラウザ）— router.tsx + link.tsx
  中央の矢印: 仮想モジュール
-->

**ビルド時**に `routes/` ディレクトリを走査して「どのパスにどのコンポーネントを表示するか」を決め、**ランタイム**でその情報をもとにルーティングする。

この分離がポイントで、ランタイムのルーターは routes の一覧を受け取るだけのシンプルな React コンポーネントになる。面倒なファイルシステムの解析はビルド時に済ませてしまう。

---

## ビルド時 — Vite の仮想モジュールという仕組み

### ディレクトリ規約

まず、ルートの規約はこうなっている。

```
src/routes/
├── layout.tsx              → ルートレイアウト
├── page.tsx               → /
├── about/
│   └── page.tsx           → /about
└── users/
    ├── layout.tsx          → /users 以下のレイアウト
    ├── page.tsx           → /users
    └── [id]/
        └── page.tsx       → /users/:id
```

- `page.tsx` があるディレクトリがルートになる
- `layout.tsx` はそのディレクトリ以下のレイアウト
- `[id]` は動的パラメータ（`:id` に変換される）

### scanner.ts — ディレクトリを歩く

`scanner.ts` は `routes/` を再帰的に探索して、ルートの一覧を作る。

```ts
export interface RouteEntry {
  path: string;       // "/users/:id"
  filePath: string;   // page.tsx のフルパス
  layouts: string[];  // layout.tsx のフルパス一覧（外→内の順）
}
```

やっていることはシンプルだ。ディレクトリを歩いて、`page.tsx` を見つけたらルートとして登録。`[id]` のようなブラケット記法は `:id` に変換する。レイアウトは今いるディレクトリから `routes/` のルートまで遡って `layout.tsx` を集める。

### plugin.ts — 仮想モジュールの生成

scanner が作った一覧を、Vite の「仮想モジュール」として提供する。仮想モジュールとは、**実際のファイルは存在しないけど `import` できるモジュール**のこと。

```ts
// アプリ側のコード
import { routes } from "virtual:orbit-router/routes";
```

この import に対して、プラグインがこんな JavaScript コードを動的に生成する:

```js
import Route0 from "/absolute/path/to/routes/page.tsx";
import Layout0 from "/absolute/path/to/routes/layout.tsx";
import Route1 from "/absolute/path/to/routes/about/page.tsx";

export const routes = [
  { path: "/", component: Route0, layouts: [Layout0] },
  { path: "/about", component: Route1, layouts: [Layout0] }
];
```

ファイルをどこにも書き出さずに、メモリ上でモジュールを作って Vite に渡す。これが仮想モジュールの仕組みだ。

Vite プラグインでは `resolveId` で「その import は自分が担当する」と宣言し、`load` で中身を返す。たった2つのフックで実現できる。

---

## ランタイム — SPA ナビゲーションの原理

### pushState — ページ遷移なしで URL を変える

SPA ルーターの核心は `history.pushState` だ。

```ts
window.history.pushState(null, "", "/about");
```

これだけで、**ページをリロードせずにブラウザの URL を `/about` に変更できる**。ただし、これだけでは画面は何も変わらない。React に「URL が変わったよ」と教えてあげる必要がある。

```ts
const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

const navigate = (to: string) => {
  window.history.pushState(null, "", to);
  setCurrentPath(to);  // ← これで React が再レンダリングする
};
```

`pushState` でブラウザの URL を変え、`setCurrentPath` で React の state を更新する。この2つのセットが SPA 遷移の正体だ。

### popstate — 戻る/進むボタンへの対応

ブラウザの戻るボタンを押すと `popstate` イベントが発火する。これを監視して state を同期させる。

```ts
useEffect(() => {
  const onPopState = () => setCurrentPath(window.location.pathname);
  window.addEventListener("popstate", onPopState);
  return () => window.removeEventListener("popstate", onPopState);
}, []);
```

`pushState` は自分で URL を変えるとき、`popstate` はブラウザが URL を変えたとき。この2つで URL と React の state が常に同期される。

---

## Link コンポーネント — 細部に宿る UX

`<Link>` は `<a>` タグをラップしたコンポーネントだ。クリック時に `preventDefault()` してページ遷移を止め、代わりに `navigate()` で SPA 遷移する。

ここで地味に重要なのが、修飾キーの判定:

```ts
if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
  return; // ブラウザのデフォルト動作に任せる
}
```

Cmd+クリック（Mac）で新しいタブ、Shift+クリックで新しいウィンドウ、右クリックでコンテキストメニュー — これらをルーターが横取りしたら、ユーザーは怒るだろう。修飾キーがあるときはブラウザに任せて、通常クリックだけを SPA 遷移にする。

もう一つ、`<Link>` が `<button>` ではなく `<a href>` を使っている理由がある。`href` があることで:

- JavaScript が無効でも普通のリンクとして動く
- 右クリック→「新しいタブで開く」が自然に動作する
- 検索エンジンのクローラーが URL を認識できる

これは **progressive enhancement** と呼ばれるアプローチで、プロダクションのルーターも同じことをやっている。

---

## ネストレイアウト — マトリョーシカ式の描画

`/users/1` にアクセスしたとき、レイアウトはこうネストされる:

```tsx
<RootLayout>        ← routes/layout.tsx
  <UsersLayout>     ← routes/users/layout.tsx
    <UserDetail />  ← routes/users/[id]/page.tsx
  </UsersLayout>
</RootLayout>
```

実装は逆順ループで組み立てる:

```ts
let content = <Page />;

// layouts = [RootLayout, UsersLayout] （外→内の順）
for (let i = layouts.length - 1; i >= 0; i--) {
  const Layout = layouts[i];
  content = <Layout>{content}</Layout>;
}
```

1. `content = <Page />`
2. `content = <UsersLayout><Page /></UsersLayout>` （内側のレイアウトで包む）
3. `content = <RootLayout><UsersLayout>...</UsersLayout></RootLayout>` （外側で包む）

内側から外側へ、マトリョーシカのように一枚ずつ包んでいく。

---

## プロダクションルーターとの距離

300行で動くルーターができた。でも Next.js や React Router との間には、まだ大きな差がある。

### 描画の無駄 — 一番大きい差

今の Orbit Router は URL が変わると **Router コンポーネント全体が再レンダリング**される。`/users/1` → `/users/2` の遷移で、変わったのは `UserDetail` だけなのに、`RootLayout` も `UsersLayout` も再描画される。

プロダクションルーターは、共通のレイアウトを再レンダリングしない。変わった部分だけを更新する。

### バンドルサイズ — 全部まとめて読み込んでいる

今は全ページのコードが1つのバンドルに入っている。10ページでも100ページでも、初回アクセスで全部ダウンロードされる。

Next.js はページごとにバンドルを分割（code splitting）し、`<Link>` がビューポートに入ったら遷移先を先読み（prefetch）する。

### これらをいつ解決するか

焦らなくていい。現状の7ルートで体感差はゼロだし、最適化には順番がある。

```
Phase 2: loader/action の設計
  └→ 部分レンダリング（レイアウト単位の state 分離）
      └→ Code splitting
          └→ Prefetch
```

loader の設計が決まらないと、レイアウトの state 分離ができない。code splitting がないと prefetch する対象がない。Phase 2 でデータフェッチの仕組みを入れるとき、自然にこれらの最適化に向き合うことになる。

---

## まとめ

Phase 1 で作ったもの:

- **Vite プラグイン** — `routes/` を走査して仮想モジュールを生成
- **Router** — URL の state 管理 + ルートマッチング + レイアウトネスト
- **Link** — pushState ベースの SPA ナビゲーション（修飾キー対応）
- **useParams** — 動的パラメータの取得
- **HMR** — routes/ の変更で自動リロード

コア部分で約300行。ルーターは魔法じゃなく、`pushState` + `popstate` + React の state という、わりと素朴な仕組みで動いている。

次の Phase 2 では、型安全なデータフェッチ（loader / action / Zod）を実装していく。ここから先が、プロダクションルーターとの差を埋める旅になる。

リポジトリ: https://github.com/ashunar0/orbit-router
