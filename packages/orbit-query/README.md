# Orbit Query

Data fetching and caching for React — designed for the AI era.

> Part of the [Orbit](../../) frontend toolkit — designed so that AI-generated code and human-written code always look the same.

## Features

- **React Compiler compatible** — `useSyncExternalStore` ベース、Proxy 不使用、クラスインスタンス不使用
- **useQuery** — データ取得 + キャッシュ + 自動再フェッチ
- **useMutation** — データ更新 + 宣言的 invalidation
- **Array keys** — 配列ベースのキーで前方一致 invalidation
- **staleTime / refetchInterval / enabled** — 主要オプション対応
- **AbortSignal** — fetch 関数にキャンセル用 signal を自動提供
- **queryOptions パターン** — query 定義を集約して key の一貫性を保つ

## Quick Start

```bash
pnpm add orbit-query
```

```tsx
import { createQueryClient, QueryProvider, useQuery, useMutation } from "orbit-query"

const queryClient = createQueryClient()

function App() {
  return (
    <QueryProvider client={queryClient}>
      <Posts />
    </QueryProvider>
  )
}
```

## useQuery

```ts
const { data, error, isLoading, isFetching, refetch } = useQuery({
  key: ["posts"],
  fn: ({ signal }) => fetch("/api/posts", { signal }).then(r => r.json()),
})
```

| 返り値 | 型 | 説明 |
|--------|----|------|
| `data` | `T \| undefined` | 取得したデータ |
| `error` | `Error \| null` | エラー |
| `isLoading` | `boolean` | 初回読み込み中 |
| `isFetching` | `boolean` | バックグラウンド再取得中 |
| `refetch` | `() => void` | 手動再取得 |

### オプション

| オプション | 型 | 説明 |
|-----------|-----|------|
| `key` | `readonly unknown[]` | **必須**。キャッシュの識別子 |
| `fn` | `(ctx: { signal: AbortSignal }) => Promise<T>` | **必須**。データ取得関数 |
| `staleTime` | `number` | キャッシュを fresh とみなす時間（ms） |
| `refetchInterval` | `number` | 自動再取得の間隔（ms） |
| `enabled` | `boolean` | `false` で自動フェッチを抑制 |

## useMutation

```ts
const { mutate, isSubmitting, error } = useMutation({
  fn: (input: { title: string }) => fetch("/api/posts", {
    method: "POST",
    body: JSON.stringify(input),
  }),
  invalidate: ["posts"],
})

mutate({ title: "Hello" })
```

成功後に `invalidate` で指定したキーの前方一致でキャッシュを自動無効化し、関連する `useQuery` が再フェッチされます。

## queryOptions パターン

query 定義を集約して、key の一貫性と可読性を保つ推奨パターン：

```ts
// queries.ts
export const postsQuery = () => ({
  key: ["posts"] as const,
  fn: ({ signal }) => fetchPosts(signal),
})

export const postQuery = (id: string) => ({
  key: ["posts", id] as const,
  fn: ({ signal }) => fetchPost(id, signal),
})
```

```ts
// 使う側
const { data } = useQuery(postsQuery())
const { data } = useQuery(postQuery("123"))
```

## QueryClient API

```ts
const queryClient = createQueryClient()
```

| メソッド | 説明 |
|---------|------|
| `fetchQuery(options)` | データ取得 + キャッシュ格納 |
| `invalidate(key)` | キーの前方一致でキャッシュ無効化 |
| `getQueryData(key)` | キャッシュを直接読む |
| `setQueryData(key, data)` | キャッシュを直接書く |

> `createQueryClient()` はプレーンオブジェクトを返します（`new` ではない）。React Compiler がクラスインスタンスをメモ化できない問題を回避するための設計です。

## License

MIT
