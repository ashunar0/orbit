# Orbit v1.0 ロードマップ & フレームワーク構想

> 2026-03-29 策定。セキュリティ監査・SSR 設計チェック・型安全性の棚卸しを経て決定。

## 全体像

```
orbit-router   orbit-query   orbit-form    ← 単独で使えるライブラリ
    │              │              │
    └──────────────┼──────────────┘
                   │
              orbit (framework)              ← 統合フレームワーク
              ・一貫した型安全性（schema 起点の型貫通）
              ・SSR
              ・invalidate キーの型安全化
```

- 個別パッケージは **単独でも使える**。フォームだけ、ルーターだけの採用が可能
- フレームワーク層が3パッケージを統合し、型安全性と SSR を提供する
- Zod を schema の single source of truth として採用（Standard Schema 等の抽象化は需要が出てから）

---

## Phase A: 個別パッケージ v1.0（CSR only）

### ゴール

API が安定し、単独で安心して使える状態にする。

### 各パッケージの状態

| パッケージ | 現バージョン | v1.0 に必要なこと |
|-----------|------------|------------------|
| orbit-router | v0.2.2 | `url` prop 追加（SSR-ready、additive）、ドキュメント整備 |
| orbit-query | v0.1.1 | `hydrate()` / `dehydrate()` 追加（SSR-ready、additive）、ドキュメント整備 |
| orbit-form | v0.1.6 | 現状で API 安定。ドキュメント整備 |

### SSR-ready の意味

v1.0 では SSR を実装しない。ただし、フレームワーク層が後から SSR を組み立てるための **フック** だけ用意する：

- **orbit-router**: `<Router url="/path">` prop（省略時は `window.location` にフォールバック）
- **orbit-query**: `client.hydrate(state)` / `dehydrate(client)` メソッド
- **orbit-form**: 変更不要（クライアントサイドのみで完結）

これらは additive な変更なので、既存の CSR ユーザーに影響しない。

### セキュリティ対応（完了）

- [x] `redirect()` に内部パスバリデーション追加（orbit-router v0.2.2）
- [x] `defaultValues` の動的ルート遷移対応（orbit-form v0.1.6）
- [x] `serializeKey` の undefined/null 衝突修正（orbit-query v0.1.1）
- [x] キャッシュ GC 追加（orbit-query v0.1.1）
- [x] `invalidate` 内の `JSON.parse` 除去（orbit-query v0.1.1）

### 残りのセキュリティ項目（低優先度、v1.x で対応可）

- [ ] `parseSearchParams` の `__proto__` キーガード
- [ ] `setValue` の `__proto__` キーガード
- [ ] `shallowEqual` の非 plain object 対応
- [ ] plugin.ts のファイルパスエスケープ

---

## Phase B: orbit フレームワーク v0.1

### ゴール

3パッケージを統合し、「全部まとめて使う」体験を提供する。

### フレームワーク層が担う責務

#### 1. SSR

サーバーで URL → Router → Query.fetch → HTML、クライアントで hydrate → SPA に切り替え。

個別パッケージの SSR-ready フックを使って実装する：
```
サーバー: url prop → Router レンダリング → Query fetch → dehydrate → HTML に埋め込み
クライアント: hydrate → Router が SPA に切り替え → 以降は CSR
```

#### 2. 一貫した型安全性

schema.ts を起点に、Router → Query → Form の全レイヤーで型を貫通させる。

**今の型フロー（棚卸し結果）:**
```
schema.ts → useForm({ schema })     ✅ 自動推論
schema.ts → server.ts → hooks.ts    ✅ fn の型から推論
schema.ts → useSearchParams(parse)  ✅ 戻り値型推論
```

**今切れている箇所:**
- `invalidate` キーが `unknown[]` — QueryKey との型的な紐付けがない
- Server 戻り値型 → Form 入力型の変換が手書き
- キャッシュ取り出し時の `as T` キャスト（これは本質的に避けられない）

**フレームワーク層で解決するもの:**
- `invalidate` キーの型安全化（Router が生成する型定義に Query キー登録を追加）
- Server → Form 変換の型支援（具体的な API は実装時に検討）

#### 3. Guard のサーバー実行（将来）

現在の guard は `useEffect` 内でクライアントのみ。サーバーサイドでの guard 実行はフレームワーク層の機能として将来追加。

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
- セキュリティ監査で **致命的な脆弱性なし** を確認（高優先度の項目は対応済み）
