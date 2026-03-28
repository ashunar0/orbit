# Orbit — ファイル規約

## 背景

AI がコードを書く時代、「何をどこに書くか」の判断ポイントが少ないほど出力が収束する。
実プロジェクトの観察から、コンポーネントファイルの肥大化パターンを分析し、この規約を導出した。

### 肥大化の実態（実プロジェクト分析）

475行のフォームコンポーネントを分類した結果：

| 分類 | 行数 | 割合 |
|------|------|------|
| UI（JSX） | 90 | 19% |
| ロジック（変換・バリデーション・ハンドラ・mutation） | 239 | 50% |
| その他（import・型定義） | 146 | 31% |

**UIの責務はたった19%。ファイルの半分はロジック。** これが肥大化の正体。

### ロジックの3分類

| 種類 | 内容 | Orbit での解決手段 |
|------|------|-------------------|
| Pure Logic | 純粋関数（データ変換、バリデーション、デフォルト値計算） | `hooks.ts` に切り出し（規約） |
| Mutation Logic | API呼び出し + 成功/失敗ハンドリング | orbit-query の `useMutation`（ライブラリ） |
| Sync Logic | useEffect による状態同期（フォーム初期化等） | orbit-form が吸収（ライブラリ） |

## ルートレベルのファイル規約

```
routes/recommend/
  page.tsx       ← UI（JSXだけ）
  hooks.ts       ← クライアントロジック（カスタムフック）
  server.ts      ← データアクセス関数（RPC スタイル）
  schema.ts      ← Zod スキーマ（バリデーション・型定義）
```

### 各ファイルの責務

| ファイル | 何を書くか | 判断基準 |
|---------|-----------|---------|
| `page.tsx` | JSX、フック呼び出し、インラインのハンドラ | ページの「目次」として読める |
| `hooks.ts` | カスタムフック、純粋関数 | 1フック1関心事。名前で意図が伝わる |
| `server.ts` | データアクセス関数（RPC スタイル。ただの関数を export） | サーバーで実行すること |
| `schema.ts` | Zod スキーマ、型定義 | データの形の定義 |

### 設計判断

**なぜ `logic.ts` と `mutation.ts` を分けずに `hooks.ts` に統合するか：**

- ファイル3つ追加は心理的にも実運用的にも重い
- pure logic と mutation logic の境界は曖昧なことが多い（例: `buildRequestData` は純粋関数だが mutation の中でしか使わない）
- 判断基準が「UIか、それ以外か」の1つだけになる
- 1ルート = 最大4ファイルなら規約として守りやすい

**なぜ server.ts は RPC スタイルか：**

- loader / action は Remix 固有の概念。RPC（ただの関数）なら誰でも読める
- ファイル名 `server.ts` が「サーバーで実行される」ことを示すため、関数に特別な名前規約は不要
- SSR 導入時もそのまま動く。Orbit がクライアント側の関数呼び出しを HTTP RPC に自動変換する

**全ファイルが必須ではない：**

- シンプルなページなら `page.tsx` だけで済む
- 膨らんできたら規約に従って分離する
- Colocation の原則：「必要になったら引き上げる」

## hooks.ts の設計原則 — page.tsx を「目次」にする

hooks.ts にロジックを切り出すとき、「ロジックを全部外に出す」のが目的ではない。
**page.tsx を開いたとき、このページが何をやっているか一目で分かる** のが目的。

### 基準: Composed Method

page.tsx のフック呼び出し部分だけ読めば、ページの処理フローが分かること。
（Kent Beck の Composed Method パターン — メソッドは同じ抽象度のステップの並びとして読めるべき）

```tsx
// page.tsx — 3行で「何をやっているか」が分かる
const { data: articles } = useArticles()
const { filtered, totalCount } = useArticleFilter(articles ?? [], search.q, search.category)
const { paged, currentPage, totalPages } = usePagination(filtered, search.page)
```

### ルール

1. **フックは1つの関心事に1つ** — 「取得して絞り込んでページ分割する」は3つのフック
2. **フック名と返り値の名前で意図が伝わること** — 中身を読まなくてもページの全体像が把握できる
3. **ハンドラや変数は page.tsx にあってよい** — `setSearch({ category: cat })` のようなインラインの操作は UI の振る舞いなので page.tsx に残す

### アンチパターン

```tsx
// ❌ 1つの巨大フックに全部入れる — 中身を読まないと何してるか分からない
const { articles, filtered, paged, handlers, ... } = useArticleSearch()

// ❌ ハンドラまで全部外に出す — page.tsx が空っぽの殻になる
const { handleSearchInput, handleCategoryChange, handlePageChange } = useArticleHandlers()
```

### なぜこうするか

「ロジックを hooks.ts に出せ」だけでは、切り出し方の基準がない。
実際に3パターン試して検証した結果：

| パターン | 問題 |
|---------|------|
| ハンドラまで全部出す | page.tsx が空の殻。何も分からない |
| 1つの大きなフックにまとめる | フックの中身を読まないと何してるか分からない |
| **責務ごとに小さく分ける** | **フック名の並びで処理フローが読める** ✅ |

判断基準は「ロジック vs UI」ではなく、**「page.tsx が目次として読めるか」**。

## コンポーネントレベル

ルートと同じパターンを適用する：

```
components/RecommendForm/
  index.tsx      ← UI
  hooks.ts       ← ロジック
  schema.ts      ← スキーマ
```

ルートレベルとの違い：
- スキャナーによる強制はない（ルートはスキャナーが認識可能）
- `server.ts` は不要（コンポーネントはクライアント側）

## schema.ts の配置ルール（Colocation）

schema.ts の置き場所は **「使う場所の一番近い共通の親」** で常に1つに決まる。

```
1. 最初はルートの schema.ts に書く
   routes/users/[id]/edit/schema.ts

2. 他のルートからも使いたくなったら、共通の親に引き上げる
   routes/users/schema.ts

3. アプリ全体で使うなら、さらに上へ
   src/schemas/user.ts
```

### schema.ts に何を書くか

Orbit のターゲット（個人開発者）は OpenAPI spec を用意しないことが多い。
schema.ts が **データの形の source of truth** になる。

```ts
// routes/users/[id]/edit/schema.ts

// データの形（source of truth）
export const userSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  createdAt: z.string().datetime(),
})

// フォーム用（派生）
export const userFormSchema = userSchema.pick({
  name: true,
  email: true,
})

// 型（派生）
export type User = z.infer<typeof userSchema>
export type UserForm = z.infer<typeof userFormSchema>
```

1つのスキーマから型もバリデーションも派生させる。二重定義が発生しない。

## 閾値の方針

**「常に分ける」ルールを推奨する。**

理由：
- 「この場合は分ける、この場合は分けない」という判断が毎回発生するコストを排除
- AI は閾値判断が苦手。「常に分ける」なら迷わない
- 薄いケースでも `useRecommendForm()` フックとして切り出せば、数行ファイルで済む
- 規約の一貫性のコストとしては許容範囲

ただし、これは推奨であって強制ではない。「規約は道標であって壁ではない」。

## 実プロジェクトからの教訓

1. **境界が曖昧だとロジックが流入する** — pages と sections の二層構造で「どっちに書く？」が毎回発生し、sections が肥大化した
2. **カスタムフック抽出の文化は自然には根付かない** — 1,575ファイル中カスタムフック11個。規約がないとロジック分離は起きない
3. **useEffect による状態同期が最大の負債** — フォーム初期化を `useEffect` + `setValue` でやるパターンが蔓延。`useForm({ defaultValues })` で解決すべき
4. **スキーマの外部ファイル化は正解** — ただし `onSubmit` 内の追加バリデーションが漏れがち。スキーマに統合すべき
5. **フック内のインフラ依存は許容する** — 目的は「純粋性」ではなく「UIとロジックの見通しを分ける」こと
