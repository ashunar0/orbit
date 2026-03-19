# Orbit Router

Directory-based React router built on Vite. Drop files into `routes/` and get type-safe routing with zero configuration.

## Features

- **File-based routing** — `routes/page.tsx` maps to `/`, `routes/about/page.tsx` to `/about`
- **Dynamic routes** — `routes/users/[id]/page.tsx` maps to `/users/:id`
- **Nested layouts** — `layout.tsx` at any level wraps child routes
- **Loaders & Actions** — `loader.ts` / `action.ts` for type-safe data fetching and mutations
- **Loading & Error states** — `loading.tsx` / `error.tsx` per route
- **404 pages** — `not-found.tsx` for custom 404 handling
- **Code splitting** — Page components are lazy-loaded with `React.lazy`
- **Prefetch** — Loader data is fetched on link hover for instant navigation
- **Search params** — `useSearchParams()` with optional Zod validation
- **Navigation state** — `useNavigation()` for progress indicators

## Quick Start

```bash
pnpm add orbit-router
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
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

export function App() {
  return <Router routes={routes} NotFound={NotFound} />;
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
    loading.tsx     → Loading state for /users
    error.tsx       → Error boundary for /users
    [id]/
      page.tsx      → /users/:id
      loader.ts     → Data fetching for /users/:id
```

- `page.tsx` — Page component (required for a route to exist)
- `layout.tsx` — Wraps child routes with `{children}` prop
- `loader.ts` — Exports `loader` function, called before page renders
- `action.ts` — Exports `action` function, called on form submission
- `loading.tsx` — Shown while loader is running (initial load)
- `error.tsx` — Shown when loader/action throws
- `not-found.tsx` — Shown when no route matches (root level)
- `[param]` directories — Dynamic route segments

## API

### Hooks

```tsx
import {
  useParams,
  useLoaderData,
  useActionData,
  useSubmit,
  useSearchParams,
  useNavigation,
  useNavigate,
} from "orbit-router";

// Route params
const { id } = useParams();

// Loader data (type-safe with typeof import)
import type { loader } from "./loader";
const data = useLoaderData<typeof loader>();

// Action data
import type { action } from "./action";
const result = useActionData<typeof action>();

// Submit action
const submit = useSubmit();
await submit(new FormData(form));

// Search params (raw or Zod-validated)
const search = useSearchParams();
const { page } = useSearchParams(myZodSchema);

// Navigation state ("idle" | "loading" | "submitting")
const { state } = useNavigation();

// Programmatic navigation
const navigate = useNavigate();
navigate("/users/1");
```

### Components

```tsx
import { Link } from "orbit-router";

// Basic link (prefetches on hover by default)
<Link href="/about">About</Link>

// Disable prefetch
<Link href="/about" prefetch={false}>About</Link>
```

### Loader / Action

```ts
// routes/users/loader.ts
export async function loader({ params, search }: {
  params: Record<string, string>;
  search: Record<string, string>;
}) {
  const res = await fetch(`/api/users?page=${search.page ?? "1"}`);
  return res.json();
}

// routes/users/action.ts
export async function action({ params, search, formData }: {
  params: Record<string, string>;
  search: Record<string, string>;
  formData: FormData;
}) {
  const name = formData.get("name");
  await fetch("/api/users", { method: "POST", body: JSON.stringify({ name }) });
  return { success: true };
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
