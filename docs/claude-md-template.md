# Orbit Router — CLAUDE.md テンプレート

新しいプロジェクトで orbit-router を使うときに、CLAUDE.md にコピペしてください。

---

ここから下をコピー ↓

---

## ルーティング（orbit-router）

orbit-router を使用。ディレクトリベースの React ルーター。
API リファレンスは `node_modules/orbit-router/README.md` を参照すること。

### セットアップ

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

仮想モジュールの型を有効にするため、エントリファイルに以下を追加：
```ts
/// <reference types="orbit-router/client" />
```

### ファイル規約

```
src/routes/
  page.tsx          → / （ページコンポーネント）
  layout.tsx        → ルートレイアウト（{children} を受け取る）
  not-found.tsx     → 404 ページ
  about/
    page.tsx        → /about
  users/
    page.tsx        → /users
    loader.ts       → データ取得（将来 server.ts に統合予定）
    action.ts       → データ変更（将来 server.ts に統合予定）
    loading.tsx     → ローディング UI
    error.tsx       → エラー UI
    [id]/
      page.tsx      → /users/:id
```

- ページは `page.tsx`（index.tsx ではない）
- レイアウトは `layout.tsx`（`{children}` prop を受け取って描画する）
- 動的セグメントは `[param]` ディレクトリ
- `_` 始まりのディレクトリはルーティング対象外

### loader / action（将来 RPC に移行予定）

> **注意**: Orbit は loader / action パターンから RPC スタイル（server.ts にただの関数を書く）に移行予定。
> 詳細は `docs/architecture.md` の「server.ts は RPC」セクションを参照。
> 以下は現行 API のリファレンス。

```ts
// loader.ts — ページ描画前にデータを取得
export async function loader({ params, search }) {
  const res = await fetch(`/api/items/${params.id}`);
  return res.json();
}

// action.ts — フォーム送信・データ変更
// JSON（デフォルト）と FormData（ファイルアップロード時）の両方に対応
export async function action({ data, formData, params, search }) {
  // JSON で送信された場合 → data に入る
  // FormData で送信された場合 → formData に入る
  await fetch("/api/items", { method: "POST", body: JSON.stringify(data) });
  return { success: true };
}
```

### hooks

```tsx
import {
  useParams,        // ルートパラメータ: { id: "123" }
  useLoaderData,    // loader の返り値（型: useLoaderData<typeof loader>()）
  useActionData,    // action の返り値
  useSubmit,        // action を呼ぶ: submit({ email, password }) or submit(formData)
  useSearchParams,  // クエリパラメータ（Zod バリデーション対応）
  useNavigation,    // ナビゲーション状態: "idle" | "loading" | "submitting"
  useNavigate,      // プログラム的遷移: navigate("/path") or navigate(-1)
} from "orbit-router";
```

### Link コンポーネント

```tsx
import { Link } from "orbit-router";

// href を使う（to ではない）。hover で自動 prefetch。
<Link href="/about">About</Link>
<Link href="/about" prefetch={false}>About</Link>
```

### guard（認証・権限ガード）

layout.tsx に `guard` 関数を export すると、loader の前に実行される。
子ルート全体に自動伝播する。

```tsx
// routes/admin/layout.tsx
import { redirect } from "orbit-router";

export async function guard() {
  const token = localStorage.getItem("session");
  if (!token) throw redirect("/login");
}

export default function AdminLayout({ children }) {
  return <div>{children}</div>;
}
```

### navigate のオプション

```ts
const navigate = useNavigate();
navigate("/dashboard");              // 通常遷移
navigate("/login", { replace: true }); // 履歴を置換（戻るで戻れなくなる）
navigate(-1);                         // ブラウザバック相当
```
