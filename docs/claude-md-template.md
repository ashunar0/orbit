# Orbit — CLAUDE.md テンプレート

新しいプロジェクトで Orbit を使うときに、CLAUDE.md にコピペしてください。
`{{...}}` はプロジェクトに合わせて置き換えること。

---

ここから下をコピー ↓

---

## プロジェクト概要

{{プロジェクトの説明}}

## 技術スタック

- **UI**: React 19
- **ルーティング**: orbit-router（ディレクトリベース）
- **データ取得**: orbit-query（useQuery / useMutation）
- **フォーム**: orbit-form（useForm / register）
- **バリデーション**: Zod
- **ツールチェーン**: Vite+

## セットアップ

```ts
// vite.config.ts
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import { orbitRouter } from "orbit-router";

export default defineConfig({
  plugins: [react(), orbitRouter()],
});
```

```tsx
// src/app.tsx
import { routes, NotFound } from "virtual:orbit-router/routes";
import { Router } from "orbit-router";
import { QueryProvider, createQueryClient } from "orbit-query";

const queryClient = createQueryClient();

export function App() {
  return (
    <QueryProvider client={queryClient}>
      <Router routes={routes} NotFound={NotFound} />
    </QueryProvider>
  );
}
```

tsconfig.json の `types` に `"orbit-router/client"` を追加すること。

## Orbit ファイル規約（必ず従うこと）

各ルートは最大4ファイルで構成される。Progressive Decomposition に従い、まず `page.tsx` だけで始め、膨らんだら分離する。

```
routes/xxx/
  page.tsx       ← UI（JSX + フック呼び出し）。ページの「目次」として読める
  hooks.ts       ← カスタムフック。1フック1関心事。名前で意図が伝わる
  server.ts      ← サーバー側のデータアクセス関数（RPC スタイル。ただの関数を export）
  schema.ts      ← Zod スキーマ + 型定義
```

### ファイル間のデータフロー（この順番で書くこと）

```
server.ts  → データアクセス関数（getTasks, createTask 等）
hooks.ts   → useQuery / useMutation でラップ（useTasks, useCreateTask 等）
page.tsx   → hooks を呼んで JSX を書く（目次）
schema.ts  → searchParams / フォームの型とバリデーション
```

### server.ts の書き方（RPC スタイル）

loader / action パターンは使わない。ただの関数を export する：

```ts
// ✅ RPC — 誰でも読める
export async function getTasks() { ... }
export async function createTask(input: TaskInput) { ... }

// ❌ loader / action — 使わない
export async function loader() { ... }
```

### hooks.ts の書き方

server.ts の関数を useQuery / useMutation でラップする：

```ts
import { useQuery, useMutation } from "orbit-query";
import { getTasks, createTask } from "./server";

export function useTasks() {
  return useQuery({ key: ["tasks"], fn: () => getTasks() });
}

export function useCreateTask() {
  const navigate = useNavigate();
  return useMutation({
    fn: createTask,
    invalidate: ["tasks"],
    onSuccess: () => navigate("/"),
  });
}
```

### page.tsx の書き方（目次パターン）

page.tsx はデータフローが上から下に読める「目次」であること：

```tsx
export default function TasksPage() {
  // State
  const [search, setSearch] = useSearchParams((raw) => searchSchema.parse(raw));

  // Fetch
  const { data: tasks, isLoading } = useTasks();

  // Transform
  const filtered = useTaskFilter(tasks, search.q, search.priority);

  // Mutate
  const { mutate: toggle } = useToggleTask();

  // Render
  return <div>...</div>;
}
```

```tsx
// ❌ 悪い例 — 1つの巨大フックに全部入れる
const { tasks, filtered, handlers, ... } = useTaskPage();
```

### orbit-form の使い方

`form.register()` でフィールドをバインドする。`<Field>` コンポーネントは使わない：

```tsx
// hooks.ts
export function useCreateTaskForm() {
  return useForm({ schema: taskCreateSchema, defaultValues: { title: "", priority: "medium" } });
}

// page.tsx
const form = useCreateTaskForm();
const { mutate: create } = useCreateTask();

<Form form={form} onSubmit={create} className="space-y-4">
  <div>
    <input {...form.register("title")} />
    {form.fieldError("title") && <p>{form.fieldError("title")}</p>}
  </div>
</Form>
```

## ルーティング規約

```
routes/page.tsx              → /
routes/layout.tsx            → ルートレイアウト
routes/about/page.tsx        → /about
routes/tasks/[id]/page.tsx   → /tasks/:id
```

- `page.tsx` = ページコンポーネント
- `layout.tsx` = レイアウト（{children} で子を囲む。データ取得しない）
- `[param]` = 動的セグメント
- `_` 始まりのディレクトリはスキップ

## 設計原則

- **読みやすさ > 書きやすさ** — 短さのために処理を隠さない
- **隠すな、揃えろ** — 暗黙の動作より明示的なコード
- **YAGNI** — 必要になるまで作らない
- **React Compiler 前提** — `useCallback` / `useMemo` / `React.memo` は書かない
- **Progressive Decomposition** — まず粗い粒度で書く → 読めなくなったら分解 → 分解先は規約で決まっている

## hooks

```tsx
import {
  useParams,        // ルートパラメータ: { id: "123" }
  useSearchParams,  // クエリパラメータ（Zod バリデーション対応）
  useNavigation,    // ナビゲーション状態: "idle" | "loading" | "submitting"
  useNavigate,      // プログラム的遷移: navigate("/path") or navigate(-1)
  Link,             // SPA リンク: <Link href="/about">About</Link>
} from "orbit-router";

import {
  useQuery,         // データ取得: useQuery({ key, fn })
  useMutation,      // データ変更: useMutation({ fn, invalidate, onSuccess })
} from "orbit-query";

import {
  useForm,          // フォーム: useForm({ schema, defaultValues })
  Form,             // フォームラッパー: <Form form={form} onSubmit={handler}>
} from "orbit-form";
```
