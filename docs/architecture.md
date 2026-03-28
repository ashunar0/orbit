# Orbit — アーキテクチャ原則

## この文書の位置づけ

Orbit の設計ドキュメントは3層構成になっている。

```
philosophy.md     → なぜ（読みやすさ優先、理解負債ゼロ）
architecture.md   → どう組み立てるか（この文書）
file-conventions.md → どこに何を置くか（page / hooks / server / schema）
```

philosophy.md が「目指す世界」、file-conventions.md が「具体的なルール」。
この文書はその間をつなぐ — **なぜそのルールが必然なのか**、構造的な根拠を示す。

## 核心原則: 余計な認知負荷を構造で排除する

認知科学では認知負荷を3種類に分類する：

| 種類 | 意味 | コードで言うと |
|------|------|--------------|
| **Intrinsic** | タスク自体の本質的な難しさ | ビジネスロジックの複雑さ。減らせない |
| **Extraneous** | 提示の仕方が悪くて生まれる余計な負荷 | 構造のバラつき、暗黙の知識、予測不能な配置 |
| **Germane** | 理解・学習に使われる良い負荷 | 規約を覚える初期コスト |

**Orbit は Extraneous（余計な負荷）を削る。** ビジネスロジックの複雑さ（Intrinsic）だけが残る状態を目指す。

規約の学習コスト（Germane）は投資として許容する。一度覚えれば、以降すべてのページで認知負荷が下がる。

## Extraneous load の4分類

フロントエンド開発で発生する「余計な認知負荷」は、4つの問いに集約できる：

| # | 余計な負荷 | 問い | Orbit の対応 |
|---|-----------|------|------------|
| 1 | **探索コスト** | 「これどこに書いてある？」 | ファイル規約で置き場を1つに決める |
| 2 | **解読コスト** | 「これ何してる？」 | 隠さない。展開済みの明示的なコード |
| 3 | **影響範囲コスト** | 「これ関係ある？」 | データの一方向フロー。依存が引数で明示 |
| 4 | **位置把握コスト** | 「今どこ読んでる？」 | page.tsx が目次。全体の中の位置がわかる |

philosophy.md の各原則は、すべてこの4つのいずれかを削減している：

- 「正しい書き方が1つ」 → 探索コスト削減（どこを見ても同じパターン）
- 「短さのために隠さない」 → 解読コスト削減
- 「規約で揃える」 → 探索コスト + 位置把握コスト削減

## ページのデータフロー

ページの処理は以下のフローで構成される：

```
State → Fetch → Transform → Mutate → Render
```

| ステップ | やること | 例 |
|---------|---------|-----|
| **State** | URL やコンテキストから状態を読む | `useSearchParams(...)` |
| **Fetch** | 外部データを取得する | `useUser(id)` |
| **Transform** | 取得したデータを加工・絞り込む | `useArticleFilter(articles, q)` |
| **Mutate** | 書き込み操作を定義する | `useUpdateUser({ onSuccess })` |
| **Render** | JSX で描画する | `return <form>...</form>` |

すべてのページがこの5ステップの**部分集合**で構成される。

- Read 系ページ: State → Fetch → Transform → Render
- Write 系ページ: State → Fetch → Transform → Mutate → Render
- シンプルなページ: Render のみ

### なぜこの順序が重要か

データが**上から下に一方向に流れる**。各ステップは前のステップの出力だけに依存する。

```tsx
// page.tsx — 上から下に読めば処理フローがわかる
const [search, setSearch] = useSearchParams(...)          // State
const { data: articles } = useArticles()                   // Fetch
const { filtered } = useArticleFilter(articles, search.q)  // Transform（Fetch の結果を使う）
const { paged } = usePagination(filtered, search.page)     // Transform（前の Transform を使う）
return <div>...</div>                                       // Render
```

逆流がないから、任意の行を読んでいるとき「この値はどこから来た？」が**上を見るだけ**でわかる。

## ファイル規約との対応

データフローの各ステップは、担当ファイルが決まる：

| ステップ | 担当ファイル | 理由 |
|---------|------------|------|
| State | `schema.ts`（型定義）+ `page.tsx`（呼び出し） | URL 状態の「形」はスキーマ、使うのはページ |
| Fetch | `hooks.ts` | データ取得は「知識」— ページは何を取るかだけ知ればいい |
| Transform | `hooks.ts` | データ加工も「知識」— ページは結果だけ受け取る |
| Mutate | `hooks.ts` | 書き込みも「知識」— ページはトリガーだけ |
| Render | `page.tsx` | 唯一 JSX を持つファイル |

**アーキテクチャ（データフローの型）が決まれば、ファイル規約は自動的に導かれる。**

file-conventions.md のルールは「こう決めた」ではなく「データフローから必然的にこうなる」。

## page.tsx と hooks.ts の関係

class 設計のアナロジーが成り立つ：

```
class → 責務を決める → メソッドに分割 → public / private を分ける
page  → データフローを決める → hooks に分割 → page.tsx / hooks.ts に分ける
```

- **hooks.ts は「知識」を持つ** — 何を取得し、どう加工し、どう書き込むかを知っている
- **page.tsx は「構成」を持つ** — hooks を組み合わせて、ページの全体像を示す

page.tsx を開いたとき、こう言えるべき：

> 「このページは **何を知っていて**（State / Fetch）、**何を加工して**（Transform）、**何をさせるか**（Mutate）」

これが言えれば、hooks の切り方は決まる。

## Progressive Decomposition — 粗い粒度から始めて、必要に応じて分解する

Orbit のデフォルトは常に**粗い粒度**。複雑さが生まれたところだけ、開発者が選択して分解する。

```
page.tsx だけ        → 膨らんだら hooks.ts / schema.ts に分離
loading.tsx（全体）  → 必要なら Suspense boundary で部分化
error.tsx（全体）    → 必要なら ErrorBoundary で部分化
```

### なぜ「粗い粒度がデフォルト」なのか

1. **AI の出力が収束する** — 「デフォルトはこう」が決まっていれば、AI は毎回同じ構造で叩き台を出せる
2. **人間がレビューしやすい** — シンプルな構造のほうが正しさを判断しやすい
3. **分解の判断は人間に残る** — 「ここは部分ローディングにしたい」は UX 判断。AI ではなく人間が決めるべき

### 具体例: エラーとローディング

ページのデータフローには正常系と異常系がある：

```
page.tsx:     State → Fetch → Transform → Mutate → Render（正常系）
error.tsx:    Fetch / Mutate の失敗 → Error Render（異常系）
loading.tsx:  Fetch の待機 → Loading Render（待機系）
```

デフォルトでは error.tsx と loading.tsx がページ全体を引き受ける。
page.tsx には正常系のフローだけが残り、「目次」としての読みやすさが保たれる。

部分的なローディングやエラー表示が必要な場合は、開発者が意識的に Suspense / ErrorBoundary を配置する。
これは「規約は道標であって壁ではない」の具体例でもある。

### 粒度のデフォルト一覧

| 関心事 | デフォルト（ページ単位） | opt-in（細かい粒度） |
|--------|----------------------|---------------------|
| ローディング | `loading.tsx` がページ全体 | Suspense boundary を自分で配置 |
| エラー | `error.tsx` がページ全体 | ErrorBoundary を自分で配置 |
| ロジック分離 | `page.tsx` にすべて | `hooks.ts` に分離 |
| スキーマ | `page.tsx` 内で inline | `schema.ts` に分離 |
| データ取得 | `hooks.ts` にまとめる | コンポーネントに co-locate |

**粒度のデフォルトが決まっている**ことで、「どこまで分けるべき？」という判断が毎回発生しない。

## アプリ全体のデータフロー

ページ内のフローは `State → Fetch → Transform → Mutate → Render` だった。
これをアプリ全体に広げると、ページの**上**にもう1つの層がある。

### 3層構造

```
Providers（共通データ層）  ← アプリ全体で共有するデータ
  ↓ Context
Layout（UI の枠）          ← 見た目の構造。データ取得しない
  ↓ children
Page（ページ層）           ← ページ固有のデータフロー
```

データは上から下に一方向に流れる。ページ内のフローと同じ原則。

### Providers — 共通データ層

複数のページで使う共有データは Context で提供する。

```
src/
  providers/           ← 必要になったら作る（Progressive Decomposition）
    auth.tsx           ← 認証ユーザー
    theme.tsx          ← テーマ設定
    index.tsx          ← まとめて export
```

**ルール: 1 Context = 1 ファイル。** 関心事ごとに分離する。

```tsx
// ✅ 関心事ごとに分離 — 認証が変わってもテーマの consumer は影響なし
<AuthProvider>
  <ThemeProvider>
    {children}
  </ThemeProvider>
</AuthProvider>

// ❌ 全部1つにまとめる — 何か1つ変わると全 consumer が再レンダリング
<AppContext value={{ me, theme, permissions, ... }}>
```

React Compiler の自動メモ化により、Context 分離のパフォーマンスペナルティはほぼない。
むしろ関心事ごとに分けたほうが、不要な再レンダリングのスコープが狭まる。

### Layout — UI の枠

layout.tsx は**描画だけ**を担当する。データ取得はしない。

```tsx
// layout.tsx — Context を読んで描画するだけ
export default function Layout({ children }) {
  const me = useAuth()  // Providers が注入したデータを読む
  return (
    <div>
      <header>{me.name}</header>
      <main>{children}</main>
    </div>
  )
}
```

layout がデータ取得を始めると、「このデータはどこから来た？」の答えが layout と page に分散する。
探索コストが上がる。だから layout は「読むだけ」に制限する。

### 規約のレイヤー

| レイヤー | 場所 | 規約 |
|---------|------|------|
| **アプリ全体** | `src/providers/` | 1 Context = 1 ファイル |
| **ルート単位** | `routes/*/` | page / hooks / server / schema |

Providers はアプリ単位、ルート規約はページ単位。レイヤーが違う。

## Progressive Decomposition の再帰的適用

Progressive Decomposition はページ内のロジック分離だけでなく、あらゆるレイヤーに同じように適用される。

### コンポーネント階層

ページ内の子コンポーネントがデータを取得するかどうかも、同じ判断で決まる：

```
最初:     page が全部取って、子に props で渡す
          → page.tsx の Fetch 一覧が「目次」として完全に機能する

膨らんだら: 子コンポーネントに Fetch を委譲する
           → page の Fetch が多すぎて目次が読めなくなったとき
           → コンポーネントを別ページでも再利用したくなったとき
```

独自の Fetch を持つ子コンポーネントは「ミニページ」— 自分だけの `Fetch → Transform → Render` を持つ。

### 全レイヤー共通の判断フレームワーク

個別のルールを覚える必要はない。判断はつねに3ステップ：

1. **まず粗い粒度で書く** — デフォルトに従う
2. **「目次として読めなくなったら」分解する** — 分解のトリガーは読みやすさ
3. **分解先は規約で決まっている** — 迷わない

| 状況 | 最初（粗い粒度） | 分解後 |
|------|-----------------|--------|
| ロジック膨らんだ | page.tsx に全部 | hooks.ts に分離 |
| Fetch 増えすぎた | page で全部取る | 子コンポーネントに委譲 |
| ローディング部分的にしたい | loading.tsx で全体 | Suspense boundary を配置 |
| エラー表示を分けたい | error.tsx で全体 | ErrorBoundary を配置 |

1つの原則を繰り返し適用するだけで、あらゆるレイヤーの設計判断が決まる。

## ページ間のデータフロー

ページ内のデータは一方向に流れる。ページ間のデータは **キャッシュ** を介してつながる。

### 基本パターン: Mutate → Invalidate → Re-fetch

一番よくあるケース — 「編集して保存したら、一覧に戻って最新データを表示したい」：

```
編集ページ:  State → Fetch → Transform → Mutate
                                            ↓ onSuccess
                                     Invalidate + Navigate
                                            ↓
一覧ページ:  Fetch（キャッシュがないので再取得）→ Render
```

コードにするとこう：

```tsx
// hooks.ts — mutation 後のページ間連携を onSuccess に書く
export function useUpdateUser() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    fn: (input) => fetch(`/api/users/${input.id}`, { method: 'PUT', body: ... }),
    onSuccess: () => {
      queryClient.invalidate(["users"])  // キャッシュを破棄 → 一覧が再取得する
      navigate("/users")                  // 一覧ページに遷移
    },
  })
}
```

### なぜこのパターンが読みやすいか

- **onSuccess に全部書いてある** — 「保存後に何が起きるか」が1箇所で完結。隠れたマジックがない
- **hooks.ts に置く** — 探索コストゼロ。mutation の副作用は mutation hook の中
- **invalidate は宣言的** — 「このキャッシュを捨てろ」とだけ言えば、該当ページが勝手に再取得する

### つなぎ方のルール

**mutation の結果が他のページに影響するとき、onSuccess でキャッシュを invalidate する。**

書く場所は hooks.ts の mutation hook の中。orbit-query（invalidate）と orbit-router（navigate）がここで合流する。

## パターンの再現性

### ライブラリが強制すること（API の形）

- `useQuery({ key, fn })` → Fetch の書き方が1つに収束
- `useMutation({ fn, onSuccess })` → Mutate + ページ間連携の書き方が収束
- `useSearchParams(parse)` → State の読み方が収束
- ファイル規約（scanner） → ファイルの置き場が収束

### ドキュメントがガイドすること（この文書）

- hooks をどう分割するか → 判断フレームワーク
- いつ分解するか → 「目次として読めなくなったら」
- 部分ローディングにするか → Progressive Decomposition
- Context をどう分けるか → 1 Context = 1 ファイル

API で**書き方**を収束させ、ドキュメントで**分け方**を導く。
強制しすぎると「隠すな」に反し、しなさすぎると「正しい書き方が1つ」に反する。

### 将来の選択肢

- **scaffold（雛形生成）** — パターンが十分に固まったら、`orbit new route` でデータフローに沿った雛形を生成する。今はまだ早い
- **lint / 静的解析** — 規模が大きくなり、チーム開発になったときに検討する
