# Changelog

## 0.1.0 (unreleased)

### Features

- File-based routing with `page.tsx` / `layout.tsx` conventions
- Dynamic routes via `[param]` directory naming
- Nested layouts with automatic collection
- Type-safe loaders (`loader.ts`) and actions (`action.ts`)
- `loading.tsx` / `error.tsx` per-route UI states
- `not-found.tsx` for custom 404 pages
- Code splitting with `React.lazy` for page components
- Link prefetch on hover for instant navigation
- `useParams()`, `useLoaderData()`, `useActionData()`, `useSubmit()`
- `useSearchParams()` with optional Zod validation
- `useNavigation()` for loading/submitting state
- `useNavigate()` for programmatic navigation
- Context split (state/dispatch) for optimal re-render performance
- HMR support for route file changes
