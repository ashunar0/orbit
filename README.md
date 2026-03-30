# Orbit

A frontend toolkit for React. Routing, data fetching, and forms — unified with consistent conventions and type safety.

> **Designed for the AI era** — One correct way to write everything. Whether AI generates it or a human writes it, the code looks the same.

## Packages

| Package                                  | Description                                         | Version |
| ---------------------------------------- | --------------------------------------------------- | ------- |
| [orbit-router](./packages/orbit-router/) | Directory-based router with typed params and links  | v1.0.0  |
| [orbit-query](./packages/orbit-query/)   | Data fetching + caching (useQuery / useMutation)    | v1.0.0  |
| [orbit-form](./packages/orbit-form/)     | React Compiler compatible forms with Zod validation | v1.0.0  |
| [orbit-rpc](./packages/orbit-rpc/)       | server.ts → Hono RPC conversion with Zod validation | v1.0.0  |
| [orbit-ssr-plugin](./packages/orbit-ssr/) | SSR with Cloudflare Workers (Vite plugin)           | v0.1.0  |

## Why Orbit?

### Code that AI writes and humans read

AI writes code fast. But **humans still have to read it** — review it, debug it, maintain it.

When a library has multiple ways to do the same thing, AI generates different code every time. Orbit eliminates that problem: **there is only one correct way**.

### The 4-File Convention

Every route follows the same structure:

```
routes/bookmarks/
  server.ts    → Data access (plain async functions)
  hooks.ts     → React hooks (useQuery / useMutation wrappers)
  schema.ts    → Zod schemas + TypeScript types
  page.tsx     → UI composition ("table of contents")
```

**`page.tsx` reads like a table of contents** — you can understand the entire page by scanning it top to bottom:

```tsx
export default function Bookmarks() {
  // State — read from URL
  const [search, setSearch] = useBookmarkSearch();

  // Fetch — get data
  const { data: bookmarks } = useBookmarks();
  const { data: tags } = useTags();

  // Transform — filter & sort
  const filtered = filterBookmarks(bookmarks ?? [], search.q, search.tag);

  // Mutate — write operations
  const { mutate: remove } = useDeleteBookmark();

  // Render
  return <div>...</div>;
}
```

### React Compiler compatible

Built from the ground up for React Compiler (automatic memoization):

- `useSyncExternalStore` for external state sync
- No Proxy-based reactivity
- No class instances in hooks
- Immutable hook return values

No `useCallback`, `useMemo`, or `React.memo` needed — the compiler handles it.

### Zero-config integration

One Vite plugin per concern. Everything works together.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { orbitRouter } from "orbit-router";
import { orbitRpc } from "orbit-rpc";
import { orbitSSR } from "orbit-ssr-plugin";

export default defineConfig({
  plugins: [react(), orbitRouter(), orbitRpc(), orbitSSR()],
});
```

## Quick Start

```bash
pnpm add orbit-router orbit-query orbit-form orbit-rpc orbit-ssr-plugin zod hono
```

### 1. Set up the router

```tsx
// src/app.tsx
import { Router } from "orbit-router";
import { routes } from "virtual:orbit-router/routes";

export function App() {
  return <Router routes={routes} />;
}
```

### 2. Create a route

```
src/routes/
  page.tsx          → /
  layout.tsx        → Root layout
  about/
    page.tsx        → /about
  users/
    page.tsx        → /users
    [id]/
      page.tsx      → /users/:id
```

Just drop files — routes appear automatically.

### 3. Add data fetching

```ts
// routes/users/server.ts
export async function getUsers(): Promise<User[]> {
  const res = await fetch("/api/users");
  return res.json();
}
```

```ts
// routes/users/hooks.ts
import { useQuery } from "orbit-query";
import { getUsers } from "./server";

export function useUsers() {
  return useQuery({
    key: ["users"],
    fn: ({ signal }) => getUsers(signal),
  });
}
```

```tsx
// routes/users/page.tsx
import { useUsers } from "./hooks";

export default function Users() {
  const { data: users, isLoading } = useUsers();
  if (isLoading) return <p>Loading...</p>;
  return (
    <ul>
      {users?.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  );
}
```

### 4. Add forms

```ts
// routes/users/schema.ts
import { z } from "zod";

export const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
});

export type UserInput = z.input<typeof userSchema>;
```

```tsx
// routes/users/new/page.tsx
import { useForm, Form } from "orbit-form";
import { userSchema } from "../schema";

export default function NewUser() {
  const form = useForm({
    schema: userSchema,
    defaultValues: { name: "", email: "" },
  });

  return (
    <Form form={form} onSubmit={handleSubmit}>
      <input {...form.register("name")} />
      {form.fieldError("name") && <p>{form.fieldError("name")}</p>}
      <input {...form.register("email")} />
      <button type="submit">Create</button>
    </Form>
  );
}
```

## Data Flow

Every page follows the same pattern: **State → Fetch → Transform → Mutate → Render**.

Data flows top to bottom. No reverse dependencies. At any line, look up to see where the data came from.

```
server.ts  → What data can I access?
hooks.ts   → How do I use it in React?
page.tsx   → What do I show?
schema.ts  → What shape is the data?
```

## Type-Safe Routing

Orbit generates route types automatically. Params and links are fully typed:

```tsx
// Typed params
const { id } = useParams<"/users/:id">()

// Typed search params
const [search, setSearch] = useSearchParams(parseSearchParams)

// Type-safe links
<Link href="/users/123">Profile</Link>
```

## File Conventions

| File            | Purpose                                                               |
| --------------- | --------------------------------------------------------------------- |
| `page.tsx`      | Page component                                                        |
| `hooks.ts`      | Custom hooks (one concern per hook)                                   |
| `server.ts`     | Server-side data access (RPC-style plain functions)                   |
| `schema.ts`     | Zod schemas + type definitions                                        |
| `layout.tsx`    | Layout wrapper (no data fetching). Can also export a `guard` function |
| `guard.ts`      | Access control (alternative to exporting guard from layout)           |
| `error.tsx`     | Error boundary                                                        |
| `loading.tsx`   | Loading state                                                         |
| `not-found.tsx` | 404 page                                                              |

## Design Philosophy

Read the full design docs:

- [Philosophy](./docs/philosophy.md) — Why readability over writability
- [Architecture](./docs/architecture.md) — Data flow, Progressive Decomposition, file conventions rationale
- [File Conventions](./docs/file-conventions.md) — Detailed rules for each file type

## Tech Stack

- [Vite](https://vite.dev/) + React 19
- [Zod](https://zod.dev/) for validation
- pnpm workspace monorepo

## Status

Orbit v1.0 is released. The core APIs (routing, data fetching, forms, RPC) are stable and validated through real application development.

## License

MIT
