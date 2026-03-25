# Orbit

React のためのフロントエンドツールキット。ルーティング・データ取得・フォームを、一貫した規約と型安全で統合する。

> **Design for the AI era** — 正しい書き方が1つしかない API 設計。AI が生成しても人間が書いても、同じコードになる。

## Packages

| パッケージ | 説明 | 状態 |
|-----------|------|------|
| [orbit-router](./packages/orbit-router/) | ディレクトリベースの React ルーター | v0.1.16 ✅ |
| orbit-query | データ取得 + キャッシュ | 設計完了、実装準備中 |
| orbit-form | React Compiler 互換のフォーム | 計画中 |

## Why Orbit?

### 1. AI が書いて、人間が読む

AI コード生成が当たり前の時代に、ライブラリの API 設計に求められるものは変わった。
同じことを書く方法が複数あると、AI は毎回違う書き方をする。チーム内で書き方がバラつく。

Orbit は **正しい書き方が1つしかない** ことを最優先に設計している。
ファイルを置く場所、データの取り方、フォームの送り方 — すべてに規約がある。

### 2. React Compiler 互換

React Compiler（自動メモ化）と完全に共存する。
`useSyncExternalStore` ベース、Proxy 不使用、クラスインスタンス不使用。
既存ライブラリが後追いで苦しんでいる互換性問題を、設計段階で解決した。

### 3. ゼロ設定の統合体験

Vite プラグインを1つ追加するだけで、ルーティング・データ取得・フォームが動く。
15個の設定ファイルは要らない。

## Quick Start

```bash
pnpm add orbit-router
```

```ts
// vite.config.ts
import { orbitRouter } from "orbit-router"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), orbitRouter()],
})
```

```
src/routes/
├── layout.tsx        → Root layout
├── page.tsx          → /
├── about/
│   └── page.tsx      → /about
└── users/
    ├── page.tsx      → /users
    ├── loader.ts     → Data fetching
    ├── action.ts     → Form handling
    └── [id]/
        └── page.tsx  → /users/:id
```

```tsx
// src/app.tsx
import { Router } from "orbit-router"
import { routes } from "virtual:orbit-router/routes"

export function App() {
  return <Router routes={routes} />
}
```

ファイルを置くだけで、ルートが生まれる。

## Tech Stack

- [Vite+](https://vite.dev/) (Rolldown, Oxlint, Vitest)
- React 19
- pnpm workspace

## Roadmap

- [x] **Phase 1** — CSR ルーター（ファイルベースルーティング、loader/action、error boundary）
- [ ] **Phase 2** — orbit-query（データ取得 + キャッシュ + Orbit Router 統合）
- [ ] **Phase 3** — 型安全ルーティング（typed params, typed links, typed search params）
- [ ] **Phase 4** — orbit-form（React Compiler 互換のフォームライブラリ）

## License

MIT
