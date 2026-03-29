# Orbit Router — チケット一覧

## Phase 1: CSR-only の最小ルーター

### ✅ 完了

- [x] **P1-01**: モノレポのスキャフォールド（Vite+ monorepo）
- [x] **P1-02**: Vite プラグインの骨格（`orbitRouter()` 関数）
- [x] **P1-03**: ディレクトリスキャナ（`scanner.ts` — `routes/` を走査してルート一覧生成）
- [x] **P1-04**: 仮想モジュール（`virtual:orbit-router/routes` でルート設定を提供）
- [x] **P1-05**: HMR 対応（`routes/` 内の変更で自動リロード）
- [x] **P1-06**: playground セットアップ（`apps/website` に React + サンプルルート）
- [x] **P1-07**: `<Router>` コンポーネント（URL 状態管理 + ルートマッチング描画）
- [x] **P1-08**: `<Link>` コンポーネント（`href` prop、`history.pushState` による SPA ナビゲーション）
- [x] **P1-09**: `popstate` イベント対応（戻る/進むボタン）
- [x] **P1-10**: 動的ルートマッチング（`/users/:id` → `{ id: "123" }` 抽出）
- [x] **P1-11**: `useParams()` hook
- [x] **P1-12**: ネストレイアウト（親ディレクトリの layout.tsx を自動収集）

- [x] **P1-13**: playground での動作確認・デモ拡充（Blog・Docs セクション、3階層ネストレイアウト）
- [x] **P1-14**: テスト整備（match / scanner ユニットテスト、Router / Link 結合テスト、全29テスト）

**🎉 Phase 1 完了！**

---

## Phase 2: 型安全なデータフェッチ

### 設計方針（確定）

- loader/action は別ファイル（`loader.ts` / `action.ts`）— 推奨パス（convention over configuration）
- 型の接続は `useLoaderData<typeof loader>()` + `import type`
- Zod スキーマは loader.ts / action.ts にコロケーション
- loading.tsx なし → 白画面、error.tsx なし → 親を探す → なければクラッシュ
- 既存ライブラリ（React Hook Form, SWR 等）との互換性あり

### ✅ 完了

- [x] **P2-01**: scanner 拡張 — `loader.ts` / `action.ts` / `loading.tsx` / `error.tsx` の検出
- [x] **P2-02**: plugin 拡張 — 仮想モジュール生成に loader/action/loading/error を追加
- [x] **P2-03**: router 拡張 — loader 呼び出し + loading/error 表示の仕組み
- [x] **P2-04**: hooks 追加 — `useLoaderData()` / `useActionData()` / `useSearchParams()`
- [x] **P2-05**: Zod 統合 — params / search params のバリデーション
- [x] **P2-06**: playground デモ — loader/loading/error の動作確認
- [x] **P2-07**: テスト整備（全44テスト pass）

**🎉 Phase 2 完了！**

---

## Phase 2.5: DX 強化

- [x] **P2.5-01**: prefetch — Link hover 時に loader を先実行し、遷移を即時に
- [x] **P2.5-02**: `not-found.tsx` 規約 — ルート単位の 404 ページ定義
- [x] **P2.5-03**: `useNavigation` デモ — playground にプログレスバーを追加
- [x] **P2.5-04**: context 分割 — 再レンダリング最適化（navigate 変更時に loaderData 依存コンポーネントが再描画されない等）
- [x] **P2.5-05**: README 更新 — Phase 2 の API（loader/action/hooks）を反映
- [x] **P2.5-06**: npm publish 準備 — package.json 整備、LICENSE、CHANGELOG

**🎉 Phase 2.5 完了！**

---

## Phase 3: Cloudflare 限定 SSR（将来）

- [ ] **P3-01**: Cloudflare Workers 上での SSR 基盤
- [ ] **P3-02**: `@cloudflare/vite-plugin` + Environment API 統合
- [ ] **P3-03**: ストリーミング SSR（`ReadableStream`）
- [ ] **P3-04**: Void プラットフォーム連携調査

---

## Phase 4: RSC 対応（将来）

- [ ] **P4-01**: `react-server-dom-*` 調査・PoC
- [ ] **P4-02**: server / client バンドル分離
- [ ] **P4-03**: `"use client"` 自動検知
