# Hackathon フィードバック — orbit-router 実プロジェクト導入記録

> 2026-03-21 — AWS ハッカソンプロジェクトで orbit-router を実際に使用した際のフィードバック

## 概要

orbit-router を実際のアプリケーション（認証フロー付き CSR アプリ）に導入した結果、
いくつかの機能不足・改善点が見つかった。以下に優先度順で記録する。

---

## 1. useNavigate の機能不足（優先度：高 / 難易度：低）✅ 実装済み

**現象:** 実際にバグとして顕在化している。

- `navigate(-1)` が動かない — 型が `(to: string) => void` なので数値を渡せない。`history.back()` 相当の機能がない
- `replace` オプションがない — `navigate("/login", { replace: true })` の第2引数が無視される。認証リダイレクト後にブラウザバックで `/login` に戻れてしまう

**対応:**

```ts
// before
useNavigate(): (to: string) => void

// after
useNavigate(): (to: string | number, options?: { replace?: boolean }) => void
```

- 数値なら `history.go(to)` に分岐
- `replace: true` なら `history.replaceState()` を使用
- Breaking change なし（既存の `navigate("/path")` はそのまま動く）

**変更ファイル:**
- `packages/orbit-router/src/runtime/router.tsx` — `navigate` 関数の実装 + `RouterDispatchContextValue` の型
- `packages/orbit-router/src/runtime/hooks.ts` — `useNavigate` の返り値の型

---

## 2. ルートレベルのガード / リダイレクト機能がない（優先度：高 / 難易度：中）

### 問題

認証ガードが `useEffect` でリダイレクトしているため、未認証ユーザーにページが一瞬見える（FOUC 的な問題）。

```tsx
// 現状: useEffect でリダイレクト → ページが一瞬描画されてしまう
function MyPage() {
  useEffect(() => {
    if (!user) navigate("/login");
  }, [user]);
  return <div>マイページの中身</div>;  // ← 未認証でも一瞬見える
}
```

### 検討プロセス

#### ガードポイントの整理

CSR アプリでガードを入れられるポイントは2箇所：

```
パスにアクセス
  → 🚧 ガードポイント①: loader の中（描画の前）
  → loader でデータ取得
  → 🚧 ガードポイント②: layout/page の描画時（コンポーネントの中）
  → UI 描画
```

| | ① loader の中 | ② layout の中 |
|---|---|---|
| タイミング | 描画の**前** | 描画の**中** |
| 止められるもの | データ取得 + 描画 | 描画だけ |
| 書き方 | `throw redirect()` | `if (!user) return <Navigate>` |

※ Next.js のミドルウェア（サーバーで実行）は CSR では存在しないレイヤー。将来 SSR（Cloudflare Workers）を実装したら使えるようになる。

#### 他フレームワークのアプローチ比較

| パターン | フレームワーク | 方式 | CSR との相性 |
|---|---|---|---|
| throw redirect | Remix / React Router v7 | loader 内で throw | 良い |
| beforeLoad | TanStack Router | 専用フック（loader と分離） | 良い |
| ミドルウェア | Next.js | サーバー側で実行 | SSR 向き |
| ナビゲーションガード | Vue Router | `router.beforeEach()` | 良い |

#### 設計の検討過程

1. **最初の案: loader 内で `throw redirect()`（Remix 方式）**
   - シンプルだが、loader がないページではガードできない
   - 「データ取得しないのに loader.ts を作る」という違和感

2. **ミドルウェア方式の検討**
   - 「loader の前に確実に差し込みたい」という要件には合う
   - しかし CSR ではサーバーがないのでミドルウェアのレイヤーが存在しない
   - ルートの設定とガードの設定が離れて「どのページが守られてるか」が分かりにくい

3. **`guard.ts` 新規ファイル規約の検討**
   - loader の前に走る専用ファイル
   - ディレクトリ構造で一目瞭然
   - ただし1ルートあたりのファイルが増えすぎる（page, layout, loader, action, loading, error, guard で7ファイル）

4. **loader.ts に guard 関数を同居させる案**
   - ファイルは増えない
   - ただし loader.ts がないページで guard だけ使いたい場合に「データ取得しないのに loader.ts を作る」問題が残る

5. **✅ 最終決定: layout.tsx に guard 関数を定義**
   - layout のネストに従って子ルートに自動伝播 → DRY
   - ディレクトリ構造でガード範囲が一目瞭然
   - 新しいファイル規約不要
   - loader の有無に関係なく使える

### 決定した設計

#### 定義方法

```tsx
// routes/admin/layout.tsx
export async function guard() {
  if (!isAuthenticated()) throw redirect("/login");
}

export default function AdminLayout({ children }) {
  return <div className="admin">{children}</div>;
}
```

- `guard` は layout.tsx に `export async function guard()` で定義する
- guard はコンポーネントの描画とは**別のタイミング**で実行される（scanner が guard 関数を収集し、router.tsx が loader の前に実行する）
- 「定義場所 = layout.tsx」と「実行タイミング = loader の前」は別の話

#### 実行フロー

```
/admin/dashboard にアクセス
  → routes/layout.tsx の guard()（あれば）
  → routes/admin/layout.tsx の guard()（あれば）
  → routes/admin/dashboard/loader.ts の loader()（あれば）
  → layout + page を描画
```

- 外側の layout の guard から順に実行
- どこかで `throw redirect()` されたら、以降の guard / loader / 描画は全てスキップ

#### 伝播ルール

```
routes/
  layout.tsx              ← guard A（全ページに効く）
  admin/
    layout.tsx            ← guard B（admin 以下に効く）
    dashboard/page.tsx    ← guard A → guard B → loader → 描画
    settings/page.tsx     ← guard A → guard B → loader → 描画
  about/page.tsx          ← guard A → loader → 描画
```

#### 認証情報の取得方法

guard は React コンポーネントの外で実行されるため、React hooks（`useAuth()` 等）は使えない。
認証状態の元データに直接アクセスする：

```ts
// ❌ React hook は使えない
export async function guard() {
  const { user } = useAuth(); // Error: hooks はコンポーネントの外で使えない
}

// ✅ 元データに直接アクセス
export async function guard() {
  // cookie / localStorage
  const token = localStorage.getItem("session");

  // Cognito 等の認証サービスに問い合わせ
  const session = await fetchAuthSession();
  if (!session.tokens) throw redirect("/login");
}
```

React Context の認証状態は元を辿れば cookie / localStorage / 外部サービスから来ている。
guard ではその元データに直接アクセスすればよい。

#### UIガードとの関係

| レイヤー | 役割 | 必要性 |
|---|---|---|
| guard（loader の前） | データ取得 + 描画を丸ごとブロック | 推奨 |
| layout の `<AuthGuard>`（描画時） | UI レベルのフォールバック | 任意 |

セキュリティは API 側（サーバー）の責務。フロントのガードはあくまで UX のため。

### 未実装 — 次のステップ

1. `redirect()` ユーティリティ関数を作る（throw するためのオブジェクト生成）
2. `scanner.ts` で layout.tsx から guard 関数を収集する
3. `plugin.ts` で仮想モジュールに guard 情報を含める
4. `router.tsx` で loader 実行前に guard を実行し、redirect を catch したら navigate する

---

## 3. action が FormData 専用（優先度：中 / 難易度：中）

**現象:** 認証フォーム（login, register, confirm）が orbit-router の action を使えていない。Cognito は JSON ベースの API なので FormData に合わない。

**提案:** `useSubmit` に JSON モードを追加。

```ts
submit({ email, password }, { encType: "application/json" });

// action 側
export async function action({ json }) { ... }
```

**影響範囲:** `runtime/router.tsx`（action 実行部分）、`useSubmit` hook

**未検討:** orbit-router 独自の設計として JSON をデフォルトにする案もある（Remix 互換 vs orbit-router らしさの判断が必要）。

---

## 4. ネストした loader データが持てない（優先度：中 / 難易度：高）

**現象:** `loaderData` が Router の state として1つだけ管理されているため、親レイアウトの loader と子ページの loader を同時に保持できない。

現時点では問題になっていないが、アプリが複雑になると困る。

**設計メモ:** #2 の guard/redirect を実装する際に、将来のネスト対応を潰さない設計にしておくこと（例: `loaderData` を `Record<routeId, data>` にする等）。

**影響範囲:** `runtime/router.tsx`（state 設計の変更）、`useLoaderData` hook

---

## 5. HMR が full-reload になっている（優先度：低〜中 / 難易度：中）

**現象:** ルートファイルを変更すると React の state が全リセットされる。

Vite の module invalidation を使った hot update にできると開発体験が向上する。

**影響範囲:** `plugin.ts`（HMR ハンドリング）

---

## 6. not-found.tsx が未作成（アプリ側の対応）

ルーター自体は `not-found.tsx` に対応済み。プロジェクト側で `routes/not-found.tsx` を配置すればOK。

---

## 優先度マトリクス

| # | 改善点 | 難易度 | インパクト | 状態 |
|---|--------|--------|------------|------|
| 1 | navigate に数値 + replace 対応 | 低 | 高（実際にバグ） | ✅ 実装済み |
| 2 | guard + redirect（layout.tsx 方式） | 中 | 高（認証フロー改善） | 設計確定、未実装 |
| 3 | action の JSON 対応 | 中 | 中（API の幅拡大） | 未検討 |
| 4 | ネスト loader データ | 高 | 中（将来の拡張性） | 未検討 |
| 5 | HMR 改善 | 中 | 中（DX 向上） | 未検討 |
