# Orbit Router

Vite + React 向けのディレクトリベースルーター。
`routes/` にファイルを置くだけでルートが自動生成される。

> **Status:** Phase 1（CSR-only）完了。Phase 2（型安全なデータフェッチ）に向けて開発中。

## Features

- **ディレクトリベースルーティング** — `routes/index.tsx` → `/`, `routes/about/index.tsx` → `/about`
- **動的ルート** — `routes/users/[id]/index.tsx` → `/users/:id`
- **ネストレイアウト** — 親ディレクトリの `layout.tsx` を自動収集してネスト描画
- **SPA ナビゲーション** — `<Link>` コンポーネントで `history.pushState` ベースの遷移
- **HMR 対応** — `routes/` の変更で自動リロード
- **Vite プラグイン** — 仮想モジュールとしてルート設定を提供

## Quick Start

```bash
pnpm install
pnpm --filter orbit-router build
pnpm --filter website dev
```

http://localhost:5173 で playground が起動する。

## Usage

### 1. Vite プラグインを登録

```ts
// vite.config.ts
import { orbitRouter } from "orbit-router";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [orbitRouter(), react()],
});
```

### 2. ルートファイルを配置

```
src/routes/
├── layout.tsx              → ルートレイアウト
├── index.tsx               → /
├── about/
│   └── index.tsx           → /about
└── users/
    ├── layout.tsx          → /users 以下のレイアウト
    ├── index.tsx           → /users
    └── [id]/
        └── index.tsx       → /users/:id
```

### 3. Router をマウント

```tsx
import { Router } from "orbit-router";
import { routes } from "virtual:orbit-router/routes";

function App() {
  return <Router routes={routes} />;
}
```

### 4. Link と useParams を使う

```tsx
import { Link, useParams } from "orbit-router";

// SPA ナビゲーション
<Link href="/users/1">Alice</Link>

// 動的パラメータの取得
function UserPage() {
  const { id } = useParams();
  return <h1>User #{id}</h1>;
}
```

## Directory Conventions

| ファイル | 役割 |
|---------|------|
| `index.tsx` | ページコンポーネント |
| `layout.tsx` | レイアウト（`{children}` で子を囲む） |
| `[param]/` | 動的セグメント |
| `_prefix/` | ルーティング対象外 |

## Tech Stack

- [Vite+](https://vite.dev/) (Rolldown, Oxlint, Vitest)
- React 19
- pnpm workspace

## Roadmap

- [x] **Phase 1** — CSR-only の最小ルーター
- [ ] **Phase 2** — 型安全なデータフェッチ（loader / action / Zod）
- [ ] **Phase 3** — Cloudflare Workers 限定 SSR
- [ ] **Phase 4** — RSC 対応

## License

MIT
