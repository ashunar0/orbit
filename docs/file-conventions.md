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
  server.ts      ← loader + action（サーバー側処理）
  schema.ts      ← Zod スキーマ（バリデーション・型定義）
```

### 各ファイルの責務

| ファイル | 何を書くか | 判断基準 |
|---------|-----------|---------|
| `page.tsx` | JSX、レイアウト、props 渡し | 見た目に関すること |
| `hooks.ts` | カスタムフック、イベントハンドラ、状態管理、純粋関数 | UIじゃないクライアントロジック全般 |
| `server.ts` | loader（データ取得）+ action（データ変更） | サーバーで実行すること |
| `schema.ts` | Zod スキーマ、型定義 | データの形の定義 |

### 設計判断

**なぜ `logic.ts` と `mutation.ts` を分けずに `hooks.ts` に統合するか：**

- ファイル3つ追加は心理的にも実運用的にも重い
- pure logic と mutation logic の境界は曖昧なことが多い（例: `buildRequestData` は純粋関数だが mutation の中でしか使わない）
- 判断基準が「UIか、それ以外か」の1つだけになる
- 1ルート = 最大4ファイルなら規約として守りやすい

**なぜ loader と action を `server.ts` にまとめるか：**

- loader と action は同じデータを扱うことが多く、同居が自然
- ファイル数を抑えられる
- SSR 導入時のサーバー処理が1ファイルに集約される

**全ファイルが必須ではない：**

- シンプルなページなら `page.tsx` だけで済む
- 膨らんできたら規約に従って分離する
- Colocation の原則：「必要になったら引き上げる」

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
