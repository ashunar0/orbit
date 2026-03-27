# Orbit Form — 設計ドキュメント

## ポジション

React Compiler 互換のフォームライブラリ。Zod をバリデーションエンジンとしてフル活用し、
useEffect による状態同期を不要にする。orbit-query との自然な統合。

最小限から始め、基盤はエンタープライズ規模に拡張できる設計にする。

## 設計原則

- **正しい書き方が1つしかない** — useEffect + setValue パターンが発生しない API 設計
- **Zod がバリデーションの全責任を持つ** — onSubmit 内の手動バリデーションを撲滅
- **React Compiler 互換** — useSyncExternalStore + セレクタ。Proxy 不使用
- **明示的** — フィールド間の依存関係がコードから読み取れる
- **YAGNI** — Phase 1 は個人開発規模（〜30フィールド）を完璧に。拡張は後から

## 背景：実プロジェクト分析から導出した課題

475行のフォームコンポーネントを分析した結果、UIはたった19%。残り50%がロジック。

### React Hook Form の構造的問題（実プロジェクトから抽出）

| # | 問題 | 実例 |
|---|------|------|
| 1 | useEffect + setValue による初期化 | useEffect 3連発でフォーム値を命令的に書き換え。eslint-disable 付き |
| 2 | watch() のフォーム全体監視 | 188フィールド全体を watch して4つの値だけ使う。全変更で全再レンダリング |
| 3 | onSubmit 内の型変換 | string → string[] 等の変換を onSubmit で手動実行 |
| 4 | onSubmit 内の追加バリデーション | setError を6回呼ぶ。Yup の型安全でないクロスフィールド参照を避けた結果 |
| 5 | ネストしたパスの型安全性がない | `setValue(\`algorithms[${i}].returnNum\`, ...)` に @ts-ignore が必要 |
| 6 | mode がフォーム全体 | フィールドごとのバリデーションタイミングを変えられない |

## API 設計

### useForm

```ts
import { useForm } from 'orbit-form'
import { userFormSchema } from './schema'

const form = useForm({
  schema: userFormSchema,              // Zod スキーマ（必須）
  defaultValues: userData,             // 非同期データもそのまま渡せる
  dependencies: {                      // フィールド間の依存ルール
    dataSource: (value, form) => {
      if (value === 'CUSTOMER') {
        form.reset('columnName')       // 宣言的にリセット
      }
    },
    percentMode: (value, form) => {
      // useEffect 不要。percentMode が変わったら自動実行
    },
  },
})
```

| オプション | 型 | 説明 |
|-----------|-----|------|
| `schema` | `ZodSchema` | バリデーション + 型推論 + transform の source of truth |
| `defaultValues` | `T \| undefined` | 初期値。非同期データ対応（undefined → データ到着で自動反映） |
| `dependencies` | `Record<string, Function>` | フィールド間の依存ルール（useEffect 代替） |

### 返り値

```ts
const {
  values,        // フォームの現在値（読み取り専用）
  errors,        // バリデーションエラー
  submit,        // 送信ハンドラ（Zod transform 適用済みの値を渡す）
  reset,         // フォームリセット
  isDirty,       // 変更があるか
  isSubmitting,  // 送信中か
} = useForm({ ... })
```

### Form / Field コンポーネント

```tsx
<Form form={form} onSubmit={mutation.mutate}>
  <Field name="name" />
  <Field name="email" />
  <button type="submit">保存</button>
</Form>
```

`<Field>` は useSyncExternalStore で自分のフィールドだけを購読する。
他のフィールドが変わっても再レンダリングしない。

### Zod による問題解決

```ts
// schema.ts — これだけで3つの問題を解決

export const recommendFormSchema = z.object({
  // 問題3の解決: フォーム型 → API型の変換
  scenarioExecutePeriod: z.string()
    .transform(v => [v]),                    // string → string[]

  percentMode: z.boolean(),
  filterValues: z.object({
    num: z.number(),
  }),
  algorithms: z.array(z.object({
    returnNum: z.number(),
    returnRate: z.number().optional(),
  })),
})
// 問題4の解決: クロスフィールドバリデーション（型安全）
.refine(
  (data) => {
    if (data.percentMode) return true
    const total = data.algorithms.reduce((s, a) => s + a.returnNum, 0)
    return data.filterValues.num <= total
  },
  { path: ['filterValues', 'num'], message: '合計を超えています' }
)

// 型推論（二重定義不要）
export type RecommendForm = z.input<typeof recommendFormSchema>     // フォーム型
export type RecommendRequest = z.output<typeof recommendFormSchema> // API型（transform後）
```

## orbit-query との統合

```ts
// hooks.ts — ファイル規約に従った分離

export function useUserEdit(userId: string) {
  const user = useQuery({
    key: ['user', userId],
    fn: () => fetchUser(userId),
  })

  const mutation = useMutation({
    fn: updateUser,
  })

  const form = useForm({
    schema: userFormSchema,
    defaultValues: user.data,    // orbit-query → orbit-form
  })

  return { form, mutation }
}

// page.tsx — UI だけ

export default function UserEditPage() {
  const { id } = useParams<'/users/:id'>()
  const { form, mutation } = useUserEdit(id)

  return (
    <Form form={form} onSubmit={mutation.mutate}>
      <Field name="name" />
      <Field name="email" />
      <button type="submit">保存</button>
    </Form>
  )
}
```

## アーキテクチャ

### 責務の境界

```
Zod が担う:
  - バリデーション（.refine, .superRefine）
  - 型変換（.transform）— フォーム型 → API型
  - 型推論（z.input / z.output）

orbit-form が担う:
  - フォーム状態管理（values, errors, touched）
  - フィールド間の依存ルール（dependencies）
  - <Form> / <Field> コンポーネント
  - useSyncExternalStore でフィールド単位の購読（React Compiler 互換）

orbit-query が担う:
  - サーバーデータの取得（defaultValues の供給元）
  - mutation（onSubmit の送信先）
```

### React Compiler 互換の細粒度サブスクリプション

```
Proxy/Signal ではなく useSyncExternalStore + セレクタで実現:

FormStore（外部ストア）
  ├── field "name"  ← Field name="name" が subscribe
  ├── field "email" ← Field name="email" が subscribe
  └── field "age"   ← Field name="age" が subscribe

"name" が変更 → Field name="name" だけ再レンダリング
              → email, age は変化なし
```

## フェーズ計画

### Phase 1: 個人開発規模を完璧に（v0.1.0）

対象: 〜30フィールド、ネスト1重まで

| # | 機能 | 優先度 |
|---|------|--------|
| 1 | useForm + Zod スキーマ統合 | 高 |
| 2 | defaultValues の非同期データ対応 | 高 |
| 3 | dependencies（フィールド間依存、useEffect 撲滅） | 高 |
| 4 | Zod transform によるフォーム型 → API型変換 | 高 |
| 5 | Zod refine によるクロスフィールドバリデーション | 高 |
| 6 | フィールド単位の再レンダリング制御 | 高 |
| 7 | Form / Field コンポーネント | 高 |
| 8 | フィールド単位のバリデーションタイミング | 中 |
| 9 | useFieldArray 相当（1重ネスト） | 中 |

### Phase 2: エンタープライズ拡張

対象: 〜800フィールド、3重ネストまで

| # | 機能 | 説明 |
|---|------|------|
| 1 | バリデーションの遅延実行 | 大量フィールド時のパフォーマンス最適化 |
| 2 | ネストした配列の型安全パス | `fields[0].groups[1].conditions[2]` を型安全に |
| 3 | 仮想スクロール対応 | 大量アイテムの描画最適化 |
| 4 | 部分更新 | 配列の1要素変更で全体を再計算しない |
| 5 | マルチステップバリデーション | スキーマをステップ分割して自動ゲーティング |

### 拡張可能性の担保

Phase 1 の設計で以下を守る:

- FormStore は外部ストアとして独立（React 非依存でテスト可能）
- フィールドの購読は selector パターン（後から粒度を細かくできる）
- バリデーション実行は store 内で完結（後からデバウンス・遅延実行を追加できる）
- 配列操作の API は Phase 1 で定義（Phase 2 で最適化だけ変える）

## 競合分析：Conform（サーバーファーストフォーム）

React Router プロジェクト（101ルート）での Conform + Zod の実態を分析。

### Conform の強み（orbit-form が参考にすべき点）

**1. サーバーサイドバリデーションとの自然な統合**

```ts
// action 内 — parseWithZod でサーバー側バリデーション
const submission = parseWithZod(await request.formData(), { schema })
if (submission.status !== 'success') {
  return { lastResult: submission.reply() }  // エラーをシリアライズして返す
}
// 成功 → DB mutation → redirect
```

バリデーション結果のシリアライズ形式が最初から設計されている。
orbit-form が SSR 対応する際のモデルになる。

**2. discriminatedUnion で1つの action に複数操作**

```ts
z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('save'), data: saveSchema }),
  z.object({ intent: z.literal('reset') }),
])
```

1つの `server.ts` に複数の操作を型安全にまとめられる。
Orbit の「loader + action を server.ts に統合」方針と相性が良い。

**3. loader/action の採用率**

- 101ルート中、loader あり 78（77%）、action あり 46（45%）
- ほぼ全 loader の最初の1行が認証チェック（`requireClientUser`）
- DB クエリロジックは `queries.server.ts` に分離

→ loader はほぼ全ルートで必要。`server.ts` は実質必須ファイルに近い。
→ 認証チェックは `guard.ts`（Orbit の既存規約）で吸収。

### Conform の弱み（orbit-form が改善すべき点）

- クライアントサイド寄りのフォーム（リッチエディタ、DM作成等）には不向き → RHF との併用が発生
- orbit-form はクライアント・サーバー両方で一貫した API を提供すべき

### 最複雑フォームの実態

| プロジェクト | ライブラリ | 最大フィールド数 | ネスト | 特徴 |
|-------------|-----------|-----------------|--------|------|
| Next.js（大規模） | RHF + Yup | 800 | 3重 | useEffect地獄、@ts-ignore多発 |
| React Router（中規模） | Conform + Zod | 49 | 動的配列 | 7タブマルチステップ |

Orbit Phase 1（〜30フィールド）で React Router プロジェクトの大半をカバー可能。

## 2プロジェクト横断の教訓

### 共通して成功しているパターン

1. **Zod ベースのバリデーション** — 両プロジェクトで採用。方向性は正しい
2. **スキーマの外部ファイル化** — schema.ts が分かれているのは正解
3. **loader/action パターン** — server.ts の正当性を裏付け
4. **認証チェックの一箇所集約** — guard.ts の正当性を裏付け

### 共通して失敗しているパターン

1. **後から統一するのは困難** — 3世代の search params 実装が混在（React Router）、sessionStorage 55キー散乱（Next.js）
2. **フォームライブラリの併用が発生** — Conform + RHF 併用（React Router）。1つで全ユースケースをカバーすべき
3. **カスタムフック抽出が根付かない** — 1,575ファイル中フック11個（Next.js）。規約なしでは分離は起きない
4. **useEffect + setValue が最大の負債** — 両プロジェクトで確認。orbit-form の dependencies で宣言的に解決

### orbit-form への示唆

- **クライアントでもサーバーでも同じ Zod スキーマでバリデーション** — Conform のサーバーファースト + RHF のクライアント体験を統合
- **バリデーション結果のシリアライズ形式を最初から設計** — SSR 対応時の基盤
- **1つのライブラリで全ユースケースをカバー** — 併用が発生しない API 設計
- **最初から一貫した規約を提供** — 後からの統一は現実的に不可能
