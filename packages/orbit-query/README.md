# Orbit Query

Data fetching and caching for React — designed for the AI era.

> Part of the [Orbit](../../) frontend toolkit — designed so that AI-generated code and human-written code always look the same.

## Features

- **React Compiler compatible** — `useSyncExternalStore` based, no Proxy, no class instances
- **useQuery** — Data fetching + caching + automatic refetch
- **useMutation** — Data mutations + declarative cache invalidation
- **Array keys** — Prefix-based invalidation with array keys
- **AbortSignal** — Automatic cancellation signal for fetch functions
- **staleTime / refetchInterval / enabled** — Essential options included
- **SSR-ready** — `dehydrate()` / `hydrate()` for server-side rendering

## Quick Start

```bash
pnpm add orbit-query
```

```tsx
import { createQueryClient, QueryProvider } from "orbit-query";

const queryClient = createQueryClient();

function App() {
  return (
    <QueryProvider client={queryClient}>
      <YourApp />
    </QueryProvider>
  );
}
```

## useQuery

```ts
import { useQuery } from "orbit-query";

const { data, error, isLoading, isFetching, refetch } = useQuery({
  key: ["posts"],
  fn: ({ signal }) => fetch("/api/posts", { signal }).then((r) => r.json()),
});
```

| Option            | Type                                           | Description                               |
| ----------------- | ---------------------------------------------- | ----------------------------------------- |
| `key`             | `readonly unknown[]`                           | **Required.** Cache identifier            |
| `fn`              | `(ctx: { signal: AbortSignal }) => Promise<T>` | **Required.** Fetch function              |
| `staleTime`       | `number`                                       | Time (ms) to consider cache fresh         |
| `refetchInterval` | `number`                                       | Auto-refetch interval (ms)                |
| `enabled`         | `boolean`                                      | Set `false` to disable automatic fetching |

## useMutation

```ts
import { useMutation } from "orbit-query";

const { mutate, isSubmitting, error } = useMutation({
  fn: (input: { title: string }) =>
    fetch("/api/posts", { method: "POST", body: JSON.stringify(input) }),
  invalidate: ["posts"],
});

await mutate({ title: "Hello" });
```

On success, caches matching the `invalidate` prefix are automatically cleared, triggering related `useQuery` hooks to refetch.

## Recommended Pattern

Wrap queries and mutations in custom hooks inside `hooks.ts`:

```ts
// routes/posts/hooks.ts
import { useQuery, useMutation } from "orbit-query";
import { getPosts, createPost } from "./server";

export function usePosts() {
  return useQuery({
    key: ["posts"],
    fn: ({ signal }) => getPosts(signal),
  });
}

export function useCreatePost() {
  return useMutation({
    fn: (data: PostInput) => createPost(data),
    invalidate: ["posts"],
  });
}
```

## QueryClient API

```ts
const queryClient = createQueryClient();
```

| Method                    | Description                                        |
| ------------------------- | -------------------------------------------------- |
| `fetchQuery(options)`     | Fetch data and store in cache                      |
| `invalidate(key)`         | Invalidate caches by prefix match                  |
| `getQueryData(key)`       | Read cache directly                                |
| `setQueryData(key, data)` | Write cache directly                               |
| `dehydrate()`             | Serialize cache to a plain object (for SSR)        |
| `hydrate(state)`          | Restore cache from a dehydrated state (for SSR)    |

## SSR Support

`dehydrate()` and `hydrate()` enable server-side rendering by transferring cache state from server to client:

```tsx
// Server: fetch data and serialize cache
const queryClient = createQueryClient();
await queryClient.fetchQuery({ key: ["posts"], fn: getPosts });
const dehydratedState = queryClient.dehydrate();
// Embed dehydratedState in HTML (e.g., as a <script> tag)
```

```tsx
// Client: restore cache before rendering
const queryClient = createQueryClient();
queryClient.hydrate(dehydratedState);

<QueryProvider client={queryClient}>
  <App />
</QueryProvider>
```

- `hydrate()` skips keys that already have data (client takes priority)
- Hydrated entries are marked as fresh, preventing unnecessary refetches on mount

## License

MIT
