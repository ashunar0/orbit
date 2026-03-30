# Orbit RPC 設計ドキュメント

> 2026-03-30 策定。SSR プロトタイプ実装後、フレームワーク層の設計議論を経て決定。

## 背景

Orbit のターゲットは「AI と一緒に開発する個人開発者」。
個人開発者が一番困るのは「React でフロントを作った。でもバックエンドどうしよう」という問題。

RPC を導入すれば、`server.ts` に関数を書くだけでフルスタックアプリが完成する。
API サーバーを別途建てる必要がない。

## 核心: server.ts はアダプター層

`server.ts` は「ただの関数を export するファイル」。
中身が何であっても、`hooks.ts` と `page.tsx` の書き方は一切変わらない。

```
server.ts の中身:
  ┌─ OpenAPI 自動生成クライアント（フロントバック分離チーム）
  ├─ 手書き fetch（外部 API を叩く）
  ├─ Orbit RPC（DB 直接アクセス、フルスタック）
  └─ 将来の何か

hooks.ts: 全パターンで同じ
page.tsx: 全パターンで同じ
schema.ts: 全パターンで同じ
```

これにより:

- **チーム開発** → バックエンドチームが API を作り、OpenAPI で自動生成した関数を server.ts に置く
- **ソロ開発** → server.ts に DB アクセスを直接書く。Orbit が RPC 化する
- **切り替え** → server.ts の中身だけ変えれば良い。hooks.ts / page.tsx は触らない

## なぜ loader / action を導入しないか

Remix は `loader` / `action` という概念でサーバー実行関数を定義する。
Orbit はこれを採用しない。理由:

1. **覚えることが増える** — loader / action は Remix 固有の概念。RPC（ただの関数）なら誰でも読める
2. **OpenAPI 自動生成との統一性が崩れる** — 自動生成で出てくるのは「ただの関数」。loader の形ではない
3. **SSR でも不要** — React 19 の Suspense streaming を使えば、useQuery がそのまま SSR のデータ取得を兼ねる

## 型の貫通

schema.ts（Zod）が全レイヤーの single source of truth:

```ts
// schema.ts — ここだけが型の定義場所
export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  done: z.boolean(),
});
export type Task = z.infer<typeof taskSchema>;

export const taskFormSchema = taskSchema.pick({ title: true, done: true });
export type TaskForm = z.infer<typeof taskFormSchema>;
```

この1つの Zod スキーマから:

- **server.ts** → 関数の引数・戻り値の型、Hono の zValidator でバリデーション
- **hooks.ts** → useQuery / useMutation の型推論
- **page.tsx** → useForm のフィールド型、バリデーション
- **RPC クライアント** → HTTP 呼び出しの型安全性

手動の型定義ゼロ。型アサートゼロ。schema.ts を変えたら全部追従する。

## 技術選定

### Hono

サーバーの土台として Hono を採用する。理由:

- **アダプターが豊富** — Cloudflare Workers, Node.js, Bun, Deno, AWS Lambda 等。将来のランタイム拡張が容易
- **Hono RPC** — Zod バリデーション + 型安全な RPC が組み込み済み
- **Orbit の思想と合う** — 「展開済みで明示的」な Hono のスタイルは「隠すな、揃えろ」と同じ

ただし、ユーザーに Hono の API（`c.req`, `c.json` 等）は露出させない。
ユーザーは `server.ts` に「ただの関数」を書く。Orbit が Hono ルートへの変換を担当する。
Hono を知らなくても使える。でも知ってる人は裏で何が起きてるか理解できる。

### Cloudflare Workers

初期ランタイムとして Cloudflare Workers を採用する。理由:

- **個人開発者に最適** — 無料枠が大きい、デプロイが `wrangler deploy` で完結
- **サーバーレス** — サーバー管理不要
- **VoidZero との親和性** — Vite+ を開発する VoidZero が Cloudflare 上のプラットフォーム（Void）を構想中
- **Hono のアダプター** — 将来 Node.js 等に拡張する時もアダプターを切り替えるだけ

## SSR との関係

RPC と SSR は独立した機能。どちらかだけでも使える。

|                | 型の貫通 | 初回表示    | API サーバー |
| -------------- | -------- | ----------- | ------------ |
| CSR のみ（今） | しない   | CSR（遅い） | 必要         |
| RPC のみ       | **する** | CSR（遅い） | **不要**     |
| SSR のみ       | しない   | SSR（速い） | 必要         |
| RPC + SSR      | **する** | SSR（速い） | **不要**     |

ロードマップ:

```
v1.0: CSR + 個別パッケージ（現状）
v1.x: RPC 導入 ← 次にやる
  server.ts の関数がサーバーで実行される
  Hono + Cloudflare Workers
  型が schema.ts から全レイヤーに貫通
v2.0: SSR 追加
  初回表示の高速化
  Suspense streaming で loader 不要
  useQuery がそのまま SSR のデータ取得を兼ねる
```

## ユーザーが書くコード（完成形イメージ）

```ts
// schema.ts
export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  done: z.boolean(),
});
export type Task = z.infer<typeof taskSchema>;
export const taskFormSchema = taskSchema.pick({ title: true, done: true });
export type TaskForm = z.infer<typeof taskFormSchema>;

// server.ts — ただの関数。Orbit が RPC 化する
export async function getTasks(): Promise<Task[]> {
  return await db.select().from(tasks);
}

export async function createTask(input: TaskForm): Promise<Task> {
  return await db.insert(tasks).values(input);
}

// hooks.ts — 変わらない
export function useTasks() {
  return useQuery({ key: ["tasks"], fn: getTasks });
}

export function useCreateTask() {
  return useMutation({ fn: createTask, invalidate: ["tasks"] });
}

// page.tsx — 変わらない
export default function TasksPage() {
  const { data: tasks } = useTasks();
  const form = useForm({ schema: taskFormSchema });
  const { mutate } = useCreateTask();

  return (
    <div>
      {tasks?.map(t => <p key={t.id}>{t.title}</p>)}
      <Form form={form} onSubmit={mutate}>
        <input {...form.register("title")} />
      </Form>
    </div>
  );
}
```

## 検証済みの事実

- SSR プロトタイプで `url` prop + `hydrate/dehydrate` が動作することを確認
- Hono RPC は `@hono/zod-validator` で Zod スキーマをそのままバリデーションに使える
- Hono の型推論と Orbit の schema.ts ベースの型フローは競合しない
- server.ts の関数シグネチャ `(input: T) => Promise<U>` は OpenAPI 自動生成の出力と同じ形
