# Orbit RPC

Auto-converts `server.ts` functions to type-safe RPC endpoints — designed for the AI era.

> Part of the [Orbit](../../) frontend toolkit — designed so that AI-generated code and human-written code always look the same.

## Features

- **Zero boilerplate** — Export a function from `server.ts`, it becomes an RPC endpoint
- **Automatic Zod validation** — Link a Zod schema in `schema.ts`, get runtime validation for free
- **Vite plugin** — Dev middleware with HMR, production build generates a Hono app
- **Cloudflare Workers ready** — `import app from "virtual:orbit-rpc/server"` and deploy
- **Type-safe end-to-end** — TypeScript types flow from schema to server to client

## Quick Start

```bash
pnpm add orbit-rpc hono
```

```ts
// vite.config.ts
import { orbitRpc } from "orbit-rpc";

export default defineConfig({
  plugins: [orbitRpc()],
});
```

Write a server function:

```ts
// src/routes/tasks/server.ts
export async function getTasks(signal?: AbortSignal) {
  const res = await fetch("https://api.example.com/tasks", { signal });
  return res.json();
}
```

Import it from the client — the plugin replaces the import with an HTTP fetch stub:

```ts
// src/routes/tasks/hooks.ts
import { getTasks } from "./server";

export function useTasks() {
  return useQuery(["tasks"], getTasks);
}
```

That's it. `getTasks()` on the client calls `POST /rpc/tasks/getTasks` under the hood.

## How It Works

The Vite plugin does two things:

1. **Client-side transform** — `server.ts` imports are replaced with `fetch()` stubs that call `POST /rpc/{route}/{function}`
2. **Server-side handler** — Dev middleware (or production Hono app) receives those requests and executes the real function

```
Client                          Server
─────                           ──────
import { getTasks }             server.ts (real function)
  from "./server"                     ↑
        │                             │
        ↓                             │
  fetch("/rpc/tasks/getTasks")  ──→  getTasks()
```

## Automatic Zod Validation

When `schema.ts` sits next to `server.ts`, the plugin automatically validates function arguments using the linked Zod schema.

```ts
// src/routes/bookmarks/schema.ts
import { z } from "zod";

export const bookmarkInputSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string()),
});

export type BookmarkInput = z.infer<typeof bookmarkInputSchema>;
```

```ts
// src/routes/bookmarks/server.ts
import type { BookmarkInput } from "./schema";

export async function createBookmark(data: BookmarkInput) {
  // `data` is already validated by Zod — invalid requests get a 400 response
  return db.insert(bookmarks).values(data);
}
```

The plugin detects `export type X = z.infer<typeof ySchema>` patterns in `schema.ts` and binds `ySchema` to the matching parameter type in `server.ts`. No manual wiring needed.

### Validation errors

Invalid requests receive a `400` response with structured error messages:

```json
{
  "error": "Validation error on \"data\": url: Invalid url, title: String must contain at least 1 character(s)"
}
```

## Production Build

Import the virtual module to get a Hono app with all RPC routes pre-registered:

```ts
// worker.ts (Cloudflare Workers entry)
import app from "virtual:orbit-rpc/server";

export default app;
```

The generated Hono app includes:
- All `server.ts` functions as `POST` routes
- Zod validation (using `safeParse`) for validated parameters
- JSON parsing with error handling
- 1MB payload size limit

## Plugin Options

```ts
orbitRpc({
  routesDir: "src/routes", // Where to scan for server.ts files (default: "src/routes")
  rpcBase: "/rpc",         // URL prefix for RPC endpoints (default: "/rpc")
});
```

## Type Flow

`schema.ts` is the single source of truth. One change propagates through all layers:

```
schema.ts                          Define Zod schema + export type
    │
    ├─→ server.ts                  Function params use the type → auto-validated
    ├─→ hooks.ts (useForm)         Form binds to the same schema → client validation
    └─→ hooks.ts (useQuery)        Return type inferred from server function
```

## Conventions

- `server.ts` — Export `async function` or `export const fn = async () => {}`
- `schema.ts` — Export Zod schemas and `z.infer` types for automatic validation
- `AbortSignal` parameters are automatically detected and passed through from `fetch`
- Dynamic route segments (`[id]`) in directory names become part of the URL prefix

## License

MIT
