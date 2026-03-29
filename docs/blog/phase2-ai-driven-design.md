# AI に書かせやすいルーターを設計した話 — Orbit Router 開発記 #2

## この記事で話すこと

自作の React ルーター「Orbit Router」に loader/action パターンを実装した。Phase 2 として型安全なデータフェッチを入れたのだが、設計の軸に据えたのは **「AI がコードを生成しやすいか」** だった。

結果、その制約が人間にとっても良い DX を生んだ。この記事ではその設計判断と「なぜそうなったか」を書く。

## 前提: Orbit Router とは

Vite プラグインとして動くディレクトリベースの React ルーター。`routes/` にファイルを置くだけでルートが自動生成される。CSR-only で 5.3KB gzip。

```
routes/
  page.tsx          → /
  layout.tsx        → ルートレイアウト
  users/
    page.tsx        → /users
    loader.ts       → データ取得
    action.ts       → ミューテーション
    [id]/
      page.tsx      → /users/:id
```

Phase 1 の話は[前回の記事](#)に書いた。今回は Phase 2 で入れた loader/action の設計について。

---

## 「AI に書かせやすい」とはどういうことか

Next.js や Remix なら、AI は学習データから規約を知っている。「loader を追加して」で通じる。では無名の自作ルーターに優位性はないのか。

ポイントは「AI が規約を知っているか」ではなく、**規約を教えたあとの出力のブレが小さいか** にある。

Remix の1ファイルに全部入りのスタイルだと、loader をファイルの先頭に書くか末尾に書くか、action との順番はどうするか、コンポーネントの中に副作用を混ぜるか — 自由度がある。自由度は AI の出力のバラつきに直結する。

Orbit は **1ファイル = 1つの役割** に制約した。`loader.ts` には loader しか書けない。`page.tsx` には UI しか書けない。CLAUDE.md に数行の規約を書くだけで、AI の出力パターンが1つに収束する。

## 設計判断 1: loader/action は別ファイルにする

Remix は loader/action/コンポーネントを1ファイルに同居させる。

```tsx
// Remix: 全部が1ファイル
export async function loader() { ... }
export async function action() { ... }
export default function UsersPage() { ... }
```

Orbit は分離した。

```
routes/users/
  page.tsx       # UI だけ
  loader.ts      # データ取得だけ
  action.ts      # ミューテーションだけ
```

### なぜ分けたか

**理由 1: 出力パターンが収束する。**

`loader.ts` には `export async function loader()` しか書かない。`page.tsx` には default export のコンポーネントしか書かない。ファイルの役割が名前で決まっているから、AI の出力に揺れが生まれない。

1ファイルに全部入りだと「loader はファイルのどこに置くか」「action との並び順は」「コンポーネントの中に副作用を混ぜるか」といった自由度がある。出力のバラつきはここから来る。

**理由 2: ファイルが太らない。**

Remix で1ルート1ファイルにすると、loader のバリデーション + action のハンドリング + コンポーネント + hooks で 200 行超えることがザラにある。ファイルが長くなると AI に渡すコンテキストが増え、精度が落ちる。

**理由 3: CSR-only ならデメリットがない。**

Remix が同一ファイルにしている理由は、サーバー/クライアントの境界をバンドラーが分離するから。同一ファイルの方がバンドラーにとって都合がいい。Orbit は CSR-only なのでこの制約がない。分けた方がシンプルに設計できる。

## 設計判断 2: 型の繋ぎ方は「import type の1行」

loader のデータをコンポーネントで使うとき、型をどう接続するか。3つの案を検討した。

| 方式               | 例                               | 特徴                               |
| ------------------ | -------------------------------- | ---------------------------------- |
| A: `typeof import` | `useLoaderData<typeof loader>()` | 標準 TS のみ、import 1行で型が通る |
| B: props 注入      | `function Page({ data })`        | シンプルだが型生成が複雑           |
| C: コード生成      | TanStack Router 方式             | 全自動だがビルドツール依存         |

**A を採用した。**

```tsx
// routes/users/page.tsx
import type { loader } from "./loader";
import { useLoaderData } from "orbit-router";

export default function UsersPage() {
  const users = useLoaderData<typeof loader>();
  //    ^? Awaited<ReturnType<typeof loader>> — 型が自動推論される
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  );
}
```

`import type` の1行は「お約束の1行」として許容できる。コード生成の魔法がない分、デバッグしやすい。AI にとっても、この1行は覚えれば毎回同じように出力できる定型パターンだ。

TanStack Router の方式（`routeTree.gen.ts` を自動生成して型を接続）は強力だが、生成されたコードの中身を理解するのが難しい。トラブル時に「型が合わない → 生成コードを見る → 何をやっているかわからない」となりがち。

## 設計判断 3: convention over configuration

loader/action は任意。page.tsx だけでルートは動く。

```tsx
// これだけで /about が動く。loader は不要。
// routes/about/page.tsx
export default function About() {
  return <h1>About</h1>;
}
```

SWR や TanStack Query を使いたければ、page.tsx の中で自由に書ける。loader は「推奨パス」であって強制ではない。

ただし、「推奨パスが1つある」ことが重要。AI に「このルートにデータ取得を追加して」と言ったとき、loader.ts を作る — これがデフォルトの回答になる。選択肢が多すぎると AI も人間も迷う。

---

## バンドルサイズ比較

```
React Router    ~14KB gzip
TanStack Router ~12KB gzip
Orbit Router    ~5.3KB gzip
```

Phase 1 完了時は 4.7KB だったのが、prefetch・context 分割・not-found サポートを入れて 5.3KB になった。それでも競合の半分以下。小さいのはスコープが CSR-only だから。SSR のアダプター層がない分だけ軽い。Phase 3 で Cloudflare Workers SSR を入れても、adapter を1つに絞る方針なので大きく膨らまない見込み。

---

## まとめ: 「AI に書かせやすい」は設計の制約として機能する

「AI に書かせやすいか」を制約にして設計したら、こうなった。

- **ファイル分離** → 各ファイルの責務が名前で自明。AI への指示が最小限で済む。
- **パターンの収束** → loader.ts の書き方が1通り。出力がブレない。
- **convention over configuration** → 推奨パスがあるが強制はしない。

これは結局、Rails や SvelteKit がやってきた「規約で導く」設計に近い。AI の登場で「規約で導く」設計の価値が改めて上がっているのだと思う。プロンプトに長々と説明を書かなくても、「ここに loader.ts を作って」で通じるフレームワーク — それが目指している姿。

Orbit Router は npm で公開している。

```bash
pnpm add orbit-router
```

GitHub: https://github.com/ashunar0/orbit-router

---

_次回は Phase 3 — Cloudflare Workers SSR の設計について書く予定。_
