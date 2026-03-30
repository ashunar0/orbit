# Orbit SSR

Server-side rendering for Orbit apps — one plugin, zero config.

> Part of the [Orbit](../../) frontend toolkit — designed so that AI-generated code and human-written code always look the same.

## Features

- **One-line setup** — Add `orbitSSR()` to your Vite config, SSR just works
- **Dev mode** — Automatic SSR middleware with HMR support
- **Production build** — `vp build` outputs client assets + Cloudflare Workers entry
- **State hydration** — Server-fetched query data flows to the client via `orbit-query`
- **Code splitting** — `React.lazy` pages work seamlessly with SSR

## Quick Start

```bash
pnpm add orbit-ssr hono
```

```ts
// vite.config.ts
import { orbitSSR } from "orbit-ssr";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    orbitRouter(),
    orbitRpc(),
    orbitSSR(),
  ],
});
```

That's it. Run `pnpm dev` and your pages are server-rendered.

## How It Works

### Dev Mode

The plugin injects SSR middleware into the Vite dev server:

1. Intercepts page requests (skips static assets, `/rpc/*`, etc.)
2. Renders your React app server-side with `renderToReadableStream`
3. Injects the HTML + dehydrated query state into `index.html`
4. Replaces the client entry with a hydration-aware version

### Production Build

`vp build` automatically runs two builds:

```
dist/
├── client/           # Static assets (deploy to CDN / CF Pages)
│   ├── assets/       # CSS, JS with content hashes
│   └── .vite/manifest.json
└── server/
    └── index.js      # Cloudflare Workers entry (Hono app)
```

The server entry is a self-contained Hono app that:
- Renders pages with SSR
- Injects client asset `<link>` and `<script>` tags from the build manifest
- Embeds dehydrated query state for seamless hydration

## Options

```ts
orbitSSR({
  entry: "index.html",  // HTML template path (default: "index.html")
  rpc: false,            // Integrate orbit-rpc routes into the Worker (default: false)
});
```

### `rpc: true`

When enabled, the production Worker serves both SSR pages and RPC endpoints in a single Hono app:

```ts
orbitSSR({ rpc: true })
```

## Deployment

### Cloudflare Workers / Pages

```toml
# wrangler.toml
name = "my-orbit-app"
main = "dist/server/index.js"
compatibility_date = "2024-01-01"

[assets]
directory = "dist/client"
```

## License

MIT
