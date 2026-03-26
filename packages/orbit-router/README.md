# Orbit Router

Directory-based React router built on Vite. Drop files into `routes/` and get routing with zero configuration.

> Part of the [Orbit](../../) frontend toolkit — designed so that AI-generated code and human-written code always look the same.

## Features

- **File-based routing** — `routes/page.tsx` maps to `/`, `routes/about/page.tsx` to `/about`
- **Dynamic routes** — `routes/users/[id]/page.tsx` maps to `/users/:id`
- **Nested layouts** — `layout.tsx` at any level wraps child routes
- **Loaders & Actions** — `loader.ts` / `action.ts` for data fetching and mutations
- **Layout loaders** — `layout.tsx` can export a `loader` too, skipped on same-layout navigations
- **Guards** — `guard.ts` for route-level access control (auth checks, redirects)
- **Redirect** — `redirect("/path")` in guards, loaders, and actions
- **Form** — `<Form>` component with JSON mode for easy action submission
- **Error boundaries** — `error.tsx` per route with automatic bubbling to parent routes
- **Error fallback** — `<Router ErrorFallback={...} />` as the last safety net
- **Loading states** — `loading.tsx` per route
- **404 pages** — `not-found.tsx` for custom 404 handling
- **Code splitting** — Page components are lazy-loaded with `React.lazy`
- **Prefetch** — Loader data is fetched on link hover for instant navigation
- **Prefetch + Guards** — Prefetch cache works correctly even with guarded routes
- **AbortSignal** — Loaders and guards receive `signal` for cancellable requests
- **Search params** — `useSearchParams()` with optional Zod validation
- **Navigation state** — `useNavigation()` for progress indicators
- **Type helpers** — `LoaderArgs` / `ActionArgs<TData>` for clean type annotations
- **Type-safe params** — `useParams<"/users/:id">()` returns `{ id: string }` with auto-generated route types
- **Type-safe links** — `<Link href="/typo">` is a type error; only valid routes are accepted
- **Type-safe navigation** — `useNavigate()` also constrained to valid routes

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
    loader.ts       → Data fetching for /users
    action.ts       → Mutations for /users
    guard.ts        → Access control for /users
    loading.tsx     → Loading state for /users
    error.tsx       → Error boundary for /users
    [id]/
      page.tsx      → /users/:id
      loader.ts     → Data fetching for /users/:id
```

- `page.tsx` — Page component (required for a route to exist)
- `layout.tsx` — Wraps child routes with `{children}` prop. Can also export a `loader` for layout-level data fetching
- `loader.ts` — Exports `loader` function, called before page renders
- `action.ts` — Exports `action` function, called on form submission
- `guard.ts` — Exports `guard` function, called before loader. Return `true` to allow, or call `redirect()` to deny
- `loading.tsx` — Shown while loader is running (initial load)
- `error.tsx` — Shown when loader/action throws. Bubbles up to the nearest parent `error.tsx` if not present
- `not-found.tsx` — Shown when no route matches (root level)
- `[param]` directories — Dynamic route segments

## API

### Hooks

```tsx
import {
  useParams,
  useLoaderData,
  useLayoutData,
  useActionData,
  useSubmit,
  useSearchParams,
  useNavigation,
  useNavigate,
} from "orbit-router"

// Route params
const { id } = useParams()

// Loader data (type-safe with typeof import)
import type { loader } from "./loader"
const data = useLoaderData<typeof loader>()

// Parent layout's loader data
import type { loader as layoutLoader } from "../loader"
const layoutData = useLayoutData<typeof layoutLoader>()

// Action data
import type { action } from "./action"
const result = useActionData<typeof action>()

// Submit action
const submit = useSubmit()
await submit(new FormData(form))

// Search params (raw or Zod-validated)
const search = useSearchParams()
const { page } = useSearchParams(myZodSchema)

// Navigation state ("idle" | "loading" | "submitting")
const { state } = useNavigation()

// Programmatic navigation
const navigate = useNavigate()
navigate("/users/1")
```

### Components

```tsx
import { Link, Form } from "orbit-router"

// Basic link (prefetches on hover by default)
<Link href="/about">About</Link>

// Disable prefetch
<Link href="/about" prefetch={false}>About</Link>

// Form submission (calls the route's action)
<Form>
  <input name="title" />
  <button type="submit">Save</button>
</Form>

// JSON mode — action receives a plain object instead of FormData
<Form json>
  <input name="title" />
  <button type="submit">Save</button>
</Form>
```

### Loader / Action / Guard

```ts
import type { LoaderArgs, ActionArgs } from "orbit-router"
import { redirect } from "orbit-router"

// routes/users/guard.ts
export async function guard({ params, signal }: LoaderArgs) {
  const session = await getSession({ signal })
  if (!session) {
    redirect("/login")
  }
  return true
}

// routes/users/loader.ts
export async function loader({ params, search, signal }: LoaderArgs) {
  const res = await fetch(`/api/users?page=${search.page ?? "1"}`, { signal })
  return res.json()
}

// routes/users/action.ts
export async function action({ data }: ActionArgs<{ name: string }>) {
  await fetch("/api/users", { method: "POST", body: JSON.stringify(data) })
  return { success: true }
}
```

### Layout Loader

`layout.tsx` can export a `loader` for shared data (e.g. current user, sidebar items). Each layout receives its own loader data via `useLoaderData()`, isolated from page loader data.

```tsx
// routes/layout.tsx
import type { LoaderArgs } from "orbit-router"
import { useLoaderData } from "orbit-router"

export async function loader({ signal }: LoaderArgs) {
  const res = await fetch("/api/me", { signal })
  return res.json()
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const user = useLoaderData<{ name: string }>()
  return (
    <div>
      <header>Hello, {user.name}</header>
      <main>{children}</main>
    </div>
  )
}
```

Child pages can access the nearest parent layout's loader data with `useLayoutData()`:

```tsx
// routes/inbox/page.tsx
import { useLayoutData } from "orbit-router"
import type { loader as layoutLoader } from "../layout"

export default function InboxPage() {
  const { projects } = useLayoutData<typeof layoutLoader>()
  const currentProject = projects.find((p) => p.id === projectId)
  // ...
}
```

When navigating between pages that share the same layout, the layout loader is **skipped** and its data is reused.

### Error Boundaries

`error.tsx` at any level catches errors from loaders, actions, and rendering. If a route doesn't have its own `error.tsx`, the error **bubbles up** to the nearest parent's `error.tsx` — matching Next.js App Router conventions.

```tsx
// routes/error.tsx — catches any unhandled error
export default function RootError({ error }: { error: Error }) {
  return <p>Something went wrong: {error.message}</p>
}
```

For errors that escape all `error.tsx` files, use the `ErrorFallback` prop on `<Router>`:

```tsx
<Router
  routes={routes}
  ErrorFallback={({ error }) => <p>Fatal: {error.message}</p>}
/>
```

### Redirect

Use `redirect()` in guards, loaders, or actions to trigger navigation. No `throw` keyword needed.

```ts
import { redirect } from "orbit-router"

export async function loader({ params }: LoaderArgs) {
  const session = getSession()
  if (!session) {
    redirect("/login") // navigates immediately
  }
  return { user: session.user }
}
```

## Architecture

Orbit Router consists of:

1. **Vite Plugin** — Scans `routes/` directory and generates a virtual module with route configuration
2. **Runtime** — `<Router>` component that matches URLs, manages state, and renders the matched route tree
3. **Hooks** — React hooks for accessing route state and dispatching navigation

Context is split into **state** (path, params, data) and **dispatch** (navigate, submit) for optimal re-render performance.

## License

MIT
