# Orbit Router

Directory-based React router built on Vite. Drop files into `routes/` and get type-safe routing with zero configuration.

> Part of the [Orbit](../../) frontend toolkit — designed so that AI-generated code and human-written code always look the same.

## Features

- **File-based routing** — `routes/page.tsx` → `/`, `routes/about/page.tsx` → `/about`
- **Dynamic routes** — `routes/users/[id]/page.tsx` → `/users/:id`
- **Nested layouts** — `layout.tsx` at any level wraps child routes
- **Guards** — `guard.ts` for route-level access control (auth checks, redirects)
- **Error boundaries** — `error.tsx` per route with automatic bubbling
- **Loading states** — `loading.tsx` per route
- **404 pages** — `not-found.tsx` for custom 404 handling
- **Code splitting** — Page components are lazy-loaded with `React.lazy`
- **Type-safe params** — `useParams<"/users/:id">()` returns `{ id: string }`
- **Type-safe links** — `<Link href="/typo">` is a type error
- **Type-safe search params** — `useSearchParams(parse)` with optional validation
- **Navigation state** — `useNavigation()` for progress indicators

## Quick Start

```bash
pnpm add orbit-router
```

```ts
// vite.config.ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { orbitRouter } from "orbit-router"

export default defineConfig({
  plugins: [react(), orbitRouter()],
})
```

```tsx
// src/app.tsx
import { routes, NotFound } from "virtual:orbit-router/routes"
import { Router } from "orbit-router"

export function App() {
  return <Router routes={routes} NotFound={NotFound} />
}
```

## File Conventions

```
src/routes/
  page.tsx          → /
  layout.tsx        → Root layout (wraps all pages)
  not-found.tsx     → Custom 404 page
  about/
    page.tsx        → /about
  users/
    page.tsx        → /users
    server.ts       → Data access (RPC-style functions)
    hooks.ts        → React hooks (useQuery wrappers)
    schema.ts       → Zod schemas + types
    guard.ts        → Access control
    loading.tsx     → Loading state
    error.tsx       → Error boundary
    [id]/
      page.tsx      → /users/:id
```

| File | Purpose |
|------|---------|
| `page.tsx` | Page component (required for a route to exist) |
| `layout.tsx` | Wraps child routes with `{children}` prop. Can also export a `guard` function |
| `guard.ts` | Separate guard file (optional, takes priority over layout export) |
| `loading.tsx` | Shown during initial page load |
| `error.tsx` | Error boundary. Bubbles up to nearest parent if not present |
| `not-found.tsx` | Custom 404 page (root level) |

## API

### Hooks

```tsx
import {
  useParams,
  useSearchParams,
  useNavigation,
  useNavigate,
} from "orbit-router"

// Type-safe params
const { id } = useParams<"/users/:id">()

// Search params with optional parsing
const [search, setSearch] = useSearchParams((raw) => ({
  page: Number(raw.page ?? 1),
  q: raw.q ?? "",
}))
setSearch({ page: 2 })    // merge into URL
setSearch({ q: null })     // remove param

// Navigation state
const { state } = useNavigation() // "idle" | "loading"

// Programmatic navigation
const navigate = useNavigate()
navigate("/users/1")
navigate(-1) // history.back()
```

### Components

```tsx
import { Link } from "orbit-router"

<Link href="/about">About</Link>
```

### Guards

Guards can be exported from `layout.tsx` (default) or placed in a separate `guard.ts` file:

```tsx
// routes/admin/layout.tsx — guard lives with the layout (recommended for short guards)
import type { GuardArgs } from "orbit-router"
import { redirect } from "orbit-router"

export async function guard({ signal }: GuardArgs) {
  const session = await getSession({ signal })
  if (!session) redirect("/login")
  return true
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
```

For complex guards, extract to a separate file:

```ts
// routes/admin/guard.ts — takes priority over layout export
import type { GuardArgs } from "orbit-router"
import { redirect } from "orbit-router"

export default async function guard({ signal }: GuardArgs) {
  // complex auth logic...
}
```

## Type Safety

Route types are auto-generated when the dev server starts. Add `.orbit` to your `tsconfig.json`:

```json
{
  "include": ["src", ".orbit"]
}
```

```tsx
// Typed params — typos become type errors
const { id } = useParams<"/users/:id">()

// Typed links — only valid routes accepted
<Link href="/users/123">Profile</Link>  // ✓
<Link href="/typo">Oops</Link>          // ✗ type error
```

## License

MIT
