# Orbit v1.0 ロードマップ & フレームワーク構想

> 2026-03-29 策定。2026-03-31 更新（Phase A 完了、Phase B SSR 実装完了）。

## 全体像

```
orbit-router   orbit-query   orbit-form   orbit-rpc    ← 単独で使えるライブラリ（v1.0.0）
    │              │              │            │
    └──────────────┼──────────────┼────────────┘
                   │              │
            orbit-ssr-plugin                            ← SSR 統合（v0.1.0）
            ・dev SSR middleware
            ・Cloudflare Workers 本番ビルド
            ・orbit-query state hydration
```

- 個別パッケージは **単独でも使える**。フォームだけ、ルーターだけの採用が可能
- orbit-ssr-plugin が SSR を提供し、パッケージ間の協調を担う
- Zod を schema の single source of truth として採用（Standard Schema 等の抽象化は需要が出てから）

---

## Phase A: 個別パッケージ v1.0（CSR only）— ✅ 完了

全パッケージ v1.0.0 npm publish 済み（2026-03-30）。

| パッケージ   | バージョン | 状態 |
| ------------ | ---------- | ---- |
| orbit-router | v1.0.0     | ✅ `url` prop（SSR-ready）、セキュリティ対応、README 完備 |
| orbit-query  | v1.0.0     | ✅ `hydrate()` / `dehydrate()`（SSR-ready）、セキュリティ対応、README 完備 |
| orbit-form   | v1.0.0     | ✅ API 安定、セキュリティ対応、README 完備 |
| orbit-rpc    | v1.0.0     | ✅ Zod 自動バリデーション、セキュリティ対応、README 完備 |
| create-orbit | -          | ✅ テンプレート更新済み、README 完備 |

### セキュリティ対応 — ✅ 完了

- [x] `redirect()` に内部パスバリデーション追加（orbit-router v0.2.2）
- [x] `defaultValues` の動的ルート遷移対応（orbit-form v0.1.6）
- [x] `serializeKey` の undefined/null 衝突修正（orbit-query v0.1.1）
- [x] キャッシュ GC 追加（orbit-query v0.1.1）
- [x] `invalidate` 内の `JSON.parse` 除去（orbit-query v0.1.1）
- [x] `parseSearchParams` の `__proto__` キーガード
- [x] `setValue` の `__proto__` キーガード
- [x] `shallowEqual` の非 plain object 対応
- [x] plugin.ts のファイルパスエスケープ（orbit-router + orbit-rpc）

---

## Phase B: SSR — ✅ コア実装完了

orbit-ssr-plugin v0.1.0 npm publish 済み（2026-03-31）。

### 実装済み

- [x] `orbitSSR()` Vite プラグイン — vite.config に1行追加で SSR 有効化
- [x] Dev SSR middleware（HMR 対応）
- [x] 本番ビルド（`vp build` で client → server 2段ビルド自動実行）
- [x] `dist/client/` — 静的アセット（CSS, JS + manifest）
- [x] `dist/server/index.js` — Cloudflare Workers エントリ（Hono アプリ）
- [x] Client manifest からアセットタグ自動注入
- [x] orbit-query dehydrate/hydrate による状態引き継ぎ
- [x] CSS import を main.tsx から自動抽出
- [x] orbit-rpc 統合オプション（`rpc: true`）
- [x] XSS 防止の JSON エスケープ

---

## 残課題

### 技術（プロダクト）

| # | 課題 | サイズ | 優先度 | 備考 |
|---|------|--------|--------|------|
| 1 | SSR 実デプロイ検証 | S | 高 | wrangler dev / CF Pages で Workers ビルドが実際に動くか確認 |
| 2 | invalidate キーの型安全化 | M | 中 | `invalidate(["users"])` のキーに型を付ける |
| 3 | schema 起点の型貫通 | L | 中 | Zod schema → server → hooks → page の型が自動で繋がる仕組み |
| 4 | `<title>` カスタマイズ | S | 低 | server-entry の HTML タイトルが "Orbit App" ハードコード |
| 5 | node:fs / node:path 警告 | S | 低 | orbit-router dist がブラウザビルドで externalize 警告 |

### ドキュメント・発信

| # | 課題 | サイズ | 備考 |
|---|------|--------|------|
| 6 | Zenn 記事執筆 | M | React Compiler 互換設計、Next.js 使わない選択肢、等 |
| 7 | X での発信 | S | SSR 対応のデモ動画、building in public |

### 運用

| # | 課題 | サイズ | 備考 |
|---|------|--------|------|
| 8 | create-orbit 動作確認 | S | `pnpm create orbit-app` でテンプレートから新規プロジェクトが立ち上がるか |
| 9 | Node.js 22+ 対応 | S | 現環境は v20、Vite+ は 22+ 推奨 |

---

## 設計原則（変わらないもの）

- **読みやすさ > 書きやすさ** — フレームワークになっても魔法は入れない
- **隠すな、揃えろ** — 暗黙の動作より明示的なコード
- **YAGNI** — Standard Schema、ORM 統合、マルチフレームワーク対応は需要が出てから
- **React Compiler 前提** — 個別パッケージもフレームワークも
- **Zod が source of truth** — 将来の抽象化の余地は残すが、今は Zod 一本

---

## 検証済みの事実

- Linear クローン（7ルート）で規約がスケールすることを確認
- CLAUDE.md だけで AI が規約に沿ったコードを生成できることを確認
- SSR 対応に **破壊的変更が不要** であることをコードレベルで確認
- セキュリティ監査で **致命的な脆弱性なし** を確認（全項目対応済み）
- dev SSR が website app で動作確認済み
- 本番ビルドが client + server の2段ビルドで正常動作確認済み
