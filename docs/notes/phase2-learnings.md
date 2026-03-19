# Phase 2 で学んだこと — 型安全なデータフェッチと性能最適化

## 1. 設計判断の記録

### loader/action を別ファイルにした理由

Remix は loader/action/component を1ファイルに同居させるが、Orbit は分離する方針にした。

```
routes/users/
  ├── page.tsx       # UI だけ
  ├── loader.ts      # データ取得
  ├── action.ts      # ミューテーション
  ├── loading.tsx     # ローディング UI
  └── error.tsx       # エラー UI
```

**理由:**
- 1ファイルが長くなるのを防ぐ（Remix の最大の不満点）
- 各ファイルの責務が名前で自明
- AI がコードを生成するとき、書き方が1パターンに収束する（Rails 的な規約）
- useState/useEffect のボイラープレートが page.tsx から消える

**Remix が同一ファイルにしている理由:**
Remix の loader/action はサーバーで実行される。ビルド時にバンドラーがサーバー/クライアントを分離するから、同一ファイルの方が都合がよかった。Orbit は CSR-only なので、ファイル分離のデメリット（ビルド時の分離が必要）がない。

### 型の繋ぎ方: `useLoaderData<typeof loader>()`

3つの方式を検討した：

| 方式 | メリット | デメリット |
|------|---------|-----------|
| A: `useLoaderData<typeof loader>()` + `import type` | 型が確実、標準 TS 機能のみ | page から loader を import する1行が必要 |
| B: props 注入 | page がシンプル | ビルド時の型生成が複雑、型チェックが弱い |
| C: コード生成で自動接続 | import 不要 + 型安全 | TanStack Router レベルの仕組みが必要 |

**A を採用。** import type の1行は「お約束の1行」として許容できるし、コード生成の魔法がない分デバッグしやすい。

### 他のルーターとの型安全性比較

- **React Router:** 手動 cast（`as { user: User }`）。params も any。
- **TanStack Router:** ルート定義オブジェクトから全自動推論。コード生成（`routeTree.gen.ts`）が必要。
- **Orbit:** `import type { loader } from './loader'` の1行で `Awaited<ReturnType<typeof loader>>` が推論される。コード生成不要。

### loader は「推奨パス」であって強制ではない

loader/action がなくても page.tsx だけで動く。SWR や TanStack Query を使いたい人はコンポーネント内で自由に書ける。Rails の「convention over configuration」と同じ考え方。

### Zod スキーマは loader.ts にコロケーション

schema.ts に分けることも検討したが、実際にスキーマを共有する必要が生じるケースは限定的（action.ts のスキーマを page.tsx の React Hook Form で使うくらい）。その場合も同じディレクトリ内の隣のファイルから import すれば済む。

### loading.tsx / error.tsx の不在時の挙動

- **loading.tsx なし → 白画面。** デフォルトスピナーを出す案もあったが、YAGNI で却下。アプリのデザインに合わないスピナーが出るリスク。
- **error.tsx なし → 親を探す → なければクラッシュ。** Next.js App Router と同じ方式。

---

## 2. 性能最適化で学んだこと

### ルーターの性能は3つのレイヤー

| レイヤー | 影響度 | 内容 | Orbit の対応 |
|---------|--------|------|-------------|
| レンダリング | 大 | 不要な再レンダリングを防ぐ | 未対応（context 分割が必要） |
| バンドルサイズ | 中 | 初期ロードに含まれるコード量 | code splitting 済み（React.lazy） |
| ルートマッチング | 小 | URL → ルート定義の照合速度 | 線形走査（ルート数が少なければ十分） |

### code splitting の実装

plugin.ts が生成する仮想モジュールで、ページコンポーネントだけを `React.lazy` にした。

```js
// 修正前: 全ページが初期バンドルに入る
import Route0 from "/routes/page.tsx";

// 修正後: ページは遷移時にオンデマンドで読み込む
const Route0 = lazy(() => import("/routes/page.tsx"));
```

layout / loader / action は static import のまま。理由:
- layout は複数ルートで共有されるから事前に読み込んでおくべき
- loader/action は関数なのでサイズが小さい

注意点: `import` 文と `const` 宣言を混在させると ES module の構文エラーになる。生成コードでは import 文を先、lazy 宣言を後に出力する必要がある。

### committed/pending URL パターン（前のページを残す方式）

Phase 2 で最も大きな学びはナビゲーション体験の設計。

**修正前:** ナビゲーション → 即座に新ルートに切り替え → Loading 表示 → データ到着

**修正後:** ナビゲーション → 前のページを表示したまま裏で loader 実行 → 完了したらスッと切り替え

この方式では2つの URL state を管理する:
- `committedUrl` — 表示中のルート（ユーザーが見ているもの）
- `pendingUrl` — 遷移先（裏で loader を実行中）

loader が完了したら `committedUrl = pendingUrl` にコミットする。loader がないルートへの遷移は即座にコミット。

React Router / TanStack Router はこの方式を採用している。Next.js は loading.tsx で画面を切り替える方式。

### stale-while-revalidate

action 後の loader 再実行では Loading を表示しない。前のデータを表示したまま裏で更新する。これにより action → 画面更新がシームレスになる。

---

## 3. レビューで学んだ頻出パターン

### useCallback/useMemo の deps 漏れ

レンダーごとに新しいオブジェクトが作られる値（`matched`, `params`）を deps に入れ忘れると stale closure になる。特に `useMemo` の deps に `currentPath` を入れたが `matched` を入れ忘れるケースが多かった。

### async 関数のキャンセルガード

`useEffect` 内の async 処理は cleanup 関数で `cancelled = true` にするパターンが必須。`submitAction` のような `useCallback` 内の async 処理では `useRef` で現在の URL を追跡し、await 前後で比較する。

### React ErrorBoundary は class component 必須

React で render 中のエラーをキャッチするには class component の `getDerivedStateFromError` を使うしかない。hooks ではキャッチできない。`key` prop を変えることで ErrorBoundary の state をリセットできる。

### popstate と navigate の非対称性

- `navigate()` — アプリが能動的に URL を変える。`pushState` を呼ぶ。
- `popstate` — ブラウザの戻る/進むボタン。`pushState` は呼ばない（ブラウザが既に URL を変えている）。

この非対称性を意識しないと、history stack が壊れる。

---

## 4. バンドルサイズ比較

```
React Router   ~14KB gzip
TanStack Router ~12KB gzip
Orbit Router    ~4.7KB gzip
```

Orbit が小さいのはスコープが CSR-only だから。SSR を入れると膨らむが、Cloudflare Workers 限定なのでアダプター層が不要な分、他より小さく保てる可能性がある。

---

## 5. 今後の課題

| 課題 | 優先度 | 備考 |
|------|--------|------|
| prefetch（Link hover で loader 先実行） | 高 | 遷移が即時になる。OSSとして欲しい |
| context 分割 | 中 | 不要な再レンダリング防止。アプリが大きくなったら |
| trie マッチング | 低 | ルート数が100超えたら検討 |
| SSR（Phase 3） | 次フェーズ | Cloudflare Workers 限定 |
