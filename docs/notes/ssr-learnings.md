# SSR 学習ノート

> 2026-03-22 — Orbit の将来の SSR 対応に向けた学習メモ

## CSR と SSR の違い

### CSR（今の Orbit Router）

```
ブラウザ                          サーバー
  │  ① HTML をリクエスト            │
  │ ─────────────────────────────→ │
  │  ② 空の HTML + JS を返す        │
  │ ←───────────────────────────── │
  │  ③ JS を実行して React を起動   │
  │  ④ loader を fetch             │
  │ ─────────────────────────────→ │
  │  ⑤ データを返す                │
  │ ←───────────────────────────── │
  │  ⑥ 描画                       │
  │  👁️ ユーザーがやっと見える      │
```

- 空の `<div id="root"></div>` が返される
- JS がロードされて React が全部組み立てる
- 問題: JS の実行が終わるまで白画面。SEO も効かない

### SSR

```
ブラウザ                          サーバー
  │  ① HTML をリクエスト            │
  │ ─────────────────────────────→ │
  │                                │  ← サーバーで React を実行
  │                                │  ← 仮想DOM → HTML文字列に変換
  │  ② 完成した HTML + JS を返す    │
  │ ←───────────────────────────── │
  │  👁️ ユーザーにはもう見える      │
  │  ③ JS を実行して hydration     │
  │  🖱️ クリックとかが効くように    │
```

- サーバーが **中身入りの HTML** を返す（空の div ではない）
- ブラウザが HTML をパースした時点で画面が見える
- その後 JS がロードされて hydration が走る

---

## Hydration（ハイドレーション）とは

### 一言で言うと

サーバーが作った「見た目だけの HTML」に、クライアント側で JavaScript のイベント（onClick, useState 等）を接続して、インタラクティブにする処理。

### 仮想 DOM のおさらい

React の JSX はビルド時に `React.createElement()` に変換され、実行されるとただの JavaScript オブジェクトになる。これが仮想 DOM:

```tsx
// JSX
<li className="task">牛乳を買う</li>

// ビルド時に変換
React.createElement("li", { className: "task" }, "牛乳を買う")

// 実行結果（仮想 DOM）= ただの JS オブジェクト
{ type: "li", props: { className: "task", children: "牛乳を買う" } }
```

CSR の流れ:
1. 空の HTML が来る
2. React がコンポーネントを実行 → 仮想 DOM ができる
3. 仮想 DOM → 本物の DOM を「生成」する
4. onClick 等も接続される
5. state が変わったら → 新しい仮想 DOM を作る → 古い仮想 DOM と比較 → 差分だけ本物の DOM に反映

### React は SSR で2回実行される

```
1回目（サーバー）:
  コンポーネント実行 → 仮想DOM → HTML文字列に変換 → ブラウザに送る
  ※ サーバーにはブラウザの DOM がないので、文字列にしかできない
  ※ onClick 等の JS は HTML 文字列にはできないので無視される

2回目（ブラウザ）:
  コンポーネント実行 → 仮想DOM → 既にある DOM と照合 → イベント接続
  ※ DOM を「生成」するのではなく「引き取る（adopt）」
  ※ CSR の createRoot() の代わりに hydrateRoot() を使う
```

### なぜ2回実行するのか

React は仮想 DOM を内部状態として持ち続ける。state が変わるたびに「古い仮想DOM vs 新しい仮想DOM」を比較して差分更新するため。hydration 時にも仮想 DOM を作らないと、その後の差分更新ができない。

これは React がもともと CSR 前提で設計されたため。SSR は後付け機能であり、仮想 DOM の仕組みを変えずに対応した結果、「2回実行」という非効率が生まれた。

### なぜ結果が一致しないとエラーになるのか

React は hydration 時に「既にある DOM を自分のものとして引き取る」。もし仮想 DOM と実際の DOM が違っていると、React の内部状態と画面がズレる。その後の差分更新が全部おかしくなるため、React は不一致を検出するとエラーにする。

### サーバーにブラウザ API がない問題

`localStorage`, `window`, `document` はサーバーに存在しない。2つのパターンで問題になる:

```tsx
// パターン A: 直接アクセス → サーバーでクラッシュ
const theme = localStorage.getItem("theme");
// → ReferenceError: localStorage is not defined

// パターン B: 条件分岐で回避 → 動くけどズレる
const theme = typeof window !== "undefined"
  ? localStorage.getItem("theme")  // ブラウザ → "dark"
  : null;                           // サーバー → null
// → hydration エラー（サーバーとクライアントで結果が違う）
```

### 他フレームワークとの対比

| フレームワーク | アプローチ |
|---|---|
| **React** | CSR 設計 → SSR 後付け → hydration が必要（2回実行） |
| **Qwik** | SSR 前提設計 → Resumability（再実行せず続きからやる） |
| **Astro** | サーバーファースト → JS を送らない = hydration 不要 |
| **Svelte** | コンパイル時最適化 → 仮想 DOM 自体がない |

---

## SSR の技術的な難しさ

### 1. Hydration のズレ問題（上記）

### 2. バンドル分離

CSR はバンドルが1つ。SSR ではサーバー用とクライアント用の2つが必要。

```
ソースコード（1つ）:
  routes/tasks/
    page.tsx       ← UI コンポーネント
    loader.ts      ← データ取得

ビルド結果（2つに分かれる）:
  client/          ← ブラウザに送るやつ
    page.js        ✅（hydration 用）
    loader.js      ❌ 入れちゃダメ！API キー等が漏洩する
  server/          ← Workers で動くやつ
    page.js        ✅（HTML 生成用）
    loader.js      ✅
```

**Orbit のファイル規約（page.tsx / loader.ts の分離）は、このバンドル分離と相性がいい。** ファイル単位で「サーバーだけ」「両方」を分けられるため。責務分離のために設計したファイル規約が、結果的に SSR のバンドル分離にも対応しやすい構造になっていた。

Vite 6 の Environment API がこのバンドル分離を自動で処理してくれる。

#### 基本 SSR vs RSC のバンドル分離の違い

```
基本 SSR: ファイル単位で分ける（loader はサーバーだけ、page は両方）
  → シンプル。Orbit のファイル規約がそのまま使える

RSC: コンポーネント単位で分ける（"use client" の境界）
  → 1つのツリーの中にサーバーとクライアントが混在
  → 開発者が境界を意識し続ける必要がある。難しい
```

`"use client"` は RSC の概念。基本 SSR だけなら不要。

### 3. データシリアライズ

サーバーの loader が取得したデータを HTML に JSON として埋め込み、クライアントに渡す必要がある。JSON にできないもの（関数、Date オブジェクト、クラスインスタンス等）は渡せない。

---

## SSR で何ができるようになるか — アーキテクチャの選択肢

### フルスタック一体型（SSR の最大の恩恵）

SSR を入れると loader.ts がサーバーで実行されるため、DB に直接アクセスできる。API 層が不要になる:

```
CSR（今）:
  ブラウザ → fetch("/api/tasks") → 別で作った API サーバー → DB
  ※ API サーバーを別途構築する必要がある

SSR（フルスタック一体型）:
  ブラウザ → Workers(loader.ts) → DB
  ※ loader.ts がサーバーで動く = それ自体が API 層
  ※ 1つのプロジェクトで完結する
```

```ts
// SSR 版 loader.ts — API サーバー不要、DB 直アクセス
export async function loader({ params }) {
  const task = await db.select().from(tasks).where(eq(tasks.id, params.id));
  return task;
}
```

これは Remix がまさにこのモデル。

### バックエンド分離（Go, Hono 等を使う場合）

以下のケースでは API 層を分ける方がいい:

- フロントチームとバックエンドチームが別
- バックエンドを Go で書きたい（パフォーマンス等）
- 複数クライアント（Web + モバイルが同じ API を叩く）
- マイクロサービス的な構成

```
Web(CSR) → API → DB
モバイル → API → DB   ← 同じ API を共有できる
```

### バックエンド分離 + SSR（4層構成）

API を分離しても SSR を入れる意味があるケースもある:

```
CSR + API:
  ブラウザ(東京) →→ ネットワーク →→ API(東京) → DB
  ユーザーの回線品質に依存。遅い人は遅い

SSR + API:
  Workers(東京) → API(東京) → DB
  サーバー間通信。安定して速い
```

4層 SSR のメリット:
- 初期表示が速い（HTML 完成済み）
- SEO が効く
- API 通信がサーバー間で安定
- ユーザーのデバイス性能に依存しない

### SSR が必要なケース vs 不要なケース

| ケース | SSR の価値 |
|---|---|
| EC サイト（初期表示 = 売上） | ◎ 高い |
| メディア・ブログ（SEO 命） | ◎ 高い |
| LP・マーケティングページ | ○ ある |
| ログイン後の管理画面 | △ 薄い |
| ダッシュボード・業務アプリ | ✕ ほぼ不要 |
| 社内ツール | ✕ 不要 |

**業務アプリ・管理画面が CSR で十分な理由:**
- ログイン必須 → SEO 不要
- インタラクティブな要素が多い → 全コンポーネントが hydration 必要 → SSR しても結局 JS を全部実行する
- 会社支給 PC or 業務端末 → デバイス性能がある程度保証される

**Orbit Router（CSR 専用）は、業務アプリ・SaaS・ツール系を全てカバーできる。** SSR は orbit-start で EC やメディアに対応するときの話。

---

## フレームワークごとのサーバーデータ取得の設計思想

### Next.js の進化

```
2016  getInitialProps()        ← 最初の「loader 的なもの」
2020  getServerSideProps()     ← Remix の loader とほぼ同じ
2019  API Routes 追加          ← これは別の目的（後述）
2023  App Router + RSC
        Server Components で直接 fetch  ← loader の概念自体がなくなった
        Server Actions                  ← Remix の action に近い
```

### getServerSideProps vs API ルート — 別物

```
getServerSideProps（loader 的）:
  → ページの描画に必要なデータを取得する
  → URL にアクセスしたときにフレームワークが自動で実行する
  → ページと 1:1 で紐づく

API ルート:
  → ページと関係ない独立した API エンドポイント
  → クライアントから fetch で明示的に叩く
  → どこからでも呼べる（モバイルアプリからも）
  → Webhook の受け口、外部連携など「ページ以外」の用途
```

Pages Router 時代の Next.js は、データ取得に `getServerSideProps`（loader 的）を使い、データ変更には API ルート（action の代わり）を使っていた。2つの仕組みが混在していた。

### 各フレームワークの思想比較

```
Remix / TanStack / Orbit:
  「データ取得も変更もルートに紐づけるべき」
  → loader = GET（データ取得）
  → action = POST（データ変更）
  → ページごとに完結。シンプル。やり方が1つに収束する

Next.js (Pages Router):
  「データ取得はルートに紐づけるけど、変更は API で」
  → getServerSideProps = データ取得 ← loader 的
  → API ルート = データ変更 ← action の代わり
  → 2つの仕組みが混在

Next.js (App Router):
  「全部コンポーネントの中でやれ」
  → Server Components で直接 fetch ← loader の概念がない
  → Server Actions ← action 的（Remix に寄せてきた）
```

Orbit が loader/action の体系を取っているのは、「AI が迷わない」という思想とも一致する。API ルートという別概念を持ち込まず、やり方を1つに収束させる。

---

## Next.js が人気な理由と弱点

### 強さ

- SSR + API ルート = 1つのプロジェクトで全部できる
- エコシステムが巨大（情報量、ライブラリ、事例）
- Vercel のデプロイ体験が良い

### 弱さ

- ビルドが遅い（Turbopack で改善中だが Vite/Rolldown に負ける）
- Vercel ロックイン（他プラットフォームへのデプロイが難しい）
- RSC / App Router の複雑さ（学習コストが高い）
- 設定・概念が増えすぎた

### Vite ベースの対抗馬（TanStack Start, Orbit 等）が狙うポジション

- Rolldown でビルド爆速
- アダプターでどこでもデプロイ（ロックインしない）
- シンプルなメンタルモデル
- Orbit は「AI 駆動開発のレール」という独自の切り口で差別化

---

## SSR / CSR と Server Component / Client Component は別の軸

名前が似ているため混同しやすいが、2つの独立した概念:

```
UI = HTML（見た目） + JS（動き）

軸①: レンダリング — HTML をどこで作るか
  CSR → ブラウザで HTML を作る
  SSR → サーバーで HTML を作る

軸②: コンポーネント種別 — JS をどこで実行するか（RSC の概念）
  Server Component → サーバーで完結。JS をクライアントに送らない
  Client Component → クライアントに JS を送って hydration する
```

### 組み合わせの表

```
                     CSR              SSR
                   (ブラウザで        (サーバーで
                    HTML生成)         HTML生成)
  ──────────────────────────────────────────────────
  RSC なし          普通の React      普通の SSR
  (従来型)          全部ブラウザ      全コンポーネントを
                    で実行            hydration
  ──────────────────────────────────────────────────
  RSC あり          ありえない        App Router
                    ※ Server         Server Component
                    Component は     → HTML だけ送る
                    サーバーが必要    Client Component
                                     → hydration する
  ──────────────────────────────────────────────────
```

### JS の量とパフォーマンスの関係

```
CSR      → 表示遅い、JS 多い、シンプル
SSR      → 表示速い、JS 多い（CSR と同じ）、やや複雑
SSR+RSC  → 表示速い、JS 少ない、激複雑
```

SSR だけでは JS の量は減らない。表示が速くなる（HTML が先に見える）だけ。RSC を足すと JS が減るが、複雑さが爆発する。

---

## RSC（React Server Components）— 別次元の複雑さ

基本 SSR とは全く別の概念。今の Orbit には不要。

### なぜ React チームは RSC を作ったのか

Pages Router 時代の問題: データを表示するだけでインタラクティブ性がないコンポーネントでも、JS が全部クライアントに送られて hydration されていた。無駄。

React チームの発想: 「インタラクティブじゃないコンポーネントは、サーバーだけで実行して HTML だけ送ればいい。JS を送る必要ない」→ これが RSC の原点。

### RSC は hydration を部分的に排除する

```
基本 SSR:
  全コンポーネント → サーバーで実行 → HTML + JS を送る → 全部 hydration

RSC:
  Server Component → サーバーで実行 → HTML だけ送る → hydration しない ✅
  Client Component → サーバーで実行 → HTML + JS を送る → hydration する
```

Server Component は hydration 自体をスキップする。JS を送らないから再実行の必要がない。ここだけ見ると Qwik の Resumability に近い発想。

### しかし複雑さが爆発した

1つのコンポーネントツリーの中に「hydration するやつ」と「しないやつ」が混在する。この境界管理が複雑:

```
Qwik:  全部 hydration しない → シンプル
RSC:   一部だけ hydration しない → 境界が複雑
```

React の仮想 DOM の仕組みを壊さずに、部分的に hydration を省略しようとした。土台を変えずに上に複雑な仕組みを積んだ結果。

### RSC が基本 SSR より難しい理由

- 独自のワイヤプロトコル（React Flight）の実装が必要
- 3つのモジュールグラフ管理（RSC環境 / SSR環境 / Client環境）
- `"use client"` 境界でのバンドル自動分割
- ライブラリ非互換（既存の React ライブラリの多くが RSC で動かない）
- セキュリティリスク（Next.js で CVSS 10.0 の RCE 脆弱性 React2Shell、2025年12月）

### Vercel と React チームの関係

- React のコアチームメンバーの多くが Vercel に所属
- RSC の仕様策定と Next.js の実装が同時進行した
- 実質的に Next.js 以外で RSC をまともに使えるフレームワークがほとんどない
- 「RSC は React の機能」だが「使えるのは Next.js だけ」という状況

### RSC は現時点では Next.js だけの話

Remix / TanStack Start / Orbit 等の他フレームワークは RSC を採用していない。基本 SSR（全コンポーネントを hydration する方式）で十分実用的であり、RSC の複雑さに見合うメリットがまだ確立されていない。

---

## Orbit の SSR 戦略

### やること（Orbit の実装範囲）

1. サーバー側で loader を実行してデータを取得
2. React を `renderToReadableStream` で HTML に変換
3. データを HTML に埋め込む（`window.__ORBIT_DATA__`）
4. クライアント側で hydration

### やらなくていいこと（インフラが解決済み）

- バンドル分離 → Vite 6 Environment API
- dev 環境での workerd 実行 → @cloudflare/vite-plugin
- ビルド → `vite build`
- デプロイ → `wrangler deploy`

### やらないこと（少なくとも当面）

- RSC
- Streaming SSR（後から段階的に追加可能）

---

## 参考情報

- Cloudflare の vinext: Next.js を Vite 上で再実装したプロジェクト。1人 + AI（Claude 800+セッション）で構築。SSR + RSC まで実装し、Next.js 16 API の 94% をカバー。ビルド 4.4倍速、バンドル 57% 小
- Vite 6 Environment API: 複数の実行環境（ブラウザ、Node.js、workerd 等）を1つの dev server で管理できる仕組み。各環境が独立したモジュールグラフを持つ
- @cloudflare/vite-plugin: Environment API を使って dev 時に workerd ランタイムでコードを実行するプラグイン。開発と本番で同じランタイムが使える
