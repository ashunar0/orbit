# AI が書いたコード、読めてますか？ — 理解負債ゼロを目指す AI 時代のフロントエンド設計

AI にコードを書かせるようになって、開発のスピードは明らかに上がった。
でも最近、ふと気づくことがある。

「このコード、自分は本当に理解してるか？」

同じ機能なのに、ファイルごとに書き方が違う。AI が書いたコードをレビューしてるはずが、気づけば「動いてるから OK」になってる。1 週間前に生成したコードを読み返して、処理の流れが追えない。

心当たりがあるなら、読み進めてほしい。

---

## 理解負債という問題

最近、こうした状況を**理解負債**と呼ぶ声がある。

コードベースに対する人間の理解が、実装の進行に置いていかれること。技術的負債とは別物だ。

技術的負債はリファクタリングで返せる。コードを書き直せばいい。
理解負債は、コードを読み直すところからやり直すしかない。もっと厄介だ。

そして AI の登場で、理解負債は加速している。

人間が書いていた時代は、書くスピード自体がボトルネックだった。書きながら理解が追いつく。でも AI は一瞬で数百行を生成する。書くスピードと理解するスピードの差が開いた分だけ、理解負債が溜まっていく。

これは個人の努力で解決できる問題じゃない。ツール側の設計で解決すべき問題だと思う。

---

## 既存ツールは「人間が書く」時代に設計された

誤解しないでほしいのだけど、React Hook Form や TanStack Query は素晴らしいライブラリだ。自分も長く使ってきた。

ただ、これらは「人間が書く」ことを前提に発展してきた。書きやすさ、柔軟さ、短く書けること — それが良いライブラリの条件だった。

AI が書く時代になって、その前提が変わった。

**柔軟さは、バラつきの原因になる。**

同じデータ取得でも、`useEffect` + `fetch` で書く方法、TanStack Query を使う方法、SWR を使う方法、カスタム hook で抽象化する方法 — 選択肢が多い。人間が書くなら「チームで決める」で済む。でも AI は指示のたびに違う選択をする。同じプロジェクトの中で、ファイルごとに書き方が違うコードベースができあがる。

**マジックは、隠蔽の原因になる。**

短く書けるライブラリほど、裏で多くのことをやっている。人間が自分で書いたなら、その裏側も理解している。でも AI が生成したマジックを、人間が後から解読するコストは重い。「動いてるけど、なぜ動いてるかわからない」コードが増えていく。

これからのライブラリには、いままでとは違う標準が求められていると思った。書きやすさではなく、読みやすさ。柔軟さではなく、一貫性。

その仮説を検証するために作ったのが Orbit だ。

---

## Orbit のアプローチ — 3 つの設計原則

Orbit は React のためのフロントエンドツールキットだ。ルーティング（orbit-router）、データ取得（orbit-query）、フォーム（orbit-form）を、一貫した規約と型安全で統合する。

設計の軸にした原則は 3 つ。

### 1. 読みやすさ > 書きやすさ

AI が書く時代に、書きやすさの優先度は下がった。書く労力は AI が引き受けてくれる。

でも、読む責任は人間に残る。AI が生成したコードが正しいか判断するのは人間だ。PR をレビューするのも、1 週間後にコードを読み返すのも人間だ。

だから Orbit は「書きやすさ」より「読みやすさ」を優先する。コードの一行一行を自然言語に翻訳できるか — これが読みやすさの判定基準。

### 2. 規約で揃える

AI の出力を収束させるには、デフォルトの道を舗装すればいい。

Orbit にはファイル規約がある。データアクセスは `server.ts`、React hooks は `hooks.ts`、型定義は `schema.ts`、UI は `page.tsx`。どのページを開いても同じ構造。AI に書かせても、人間が書いても、同じコードになる。

ただし、規約は道標であって壁ではない。デフォルトに従えばシンプルで読みやすいコードになるが、逸れることを禁止はしない。

### 3. 隠さない

短く書くためにマジックを使わない。処理を覆い隠さず、展開済みの状態をコードに書く。

多少長くなっても、読めばわかるほうが価値がある。AI がどれだけコードを書いても、人間がその場で理解できる状態を保つ。

---

## 実際のコード — page.tsx が「目次」として読める

原則だけでは伝わらないので、コードで見せたい。

AI がよく生成する典型的な React コンポーネントはこうなりがちだ:

```tsx
export default function Bookmarks() {
  const [query, setQuery] = useState("")
  const [tag, setTag] = useState("")
  const [bookmarks, setBookmarks] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bookmarks").then(r => r.json()).then(data => {
      setBookmarks(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    fetch("/api/tags").then(r => r.json()).then(setTags)
  }, [])

  const filtered = bookmarks.filter(b =>
    (query === "" || b.title.includes(query)) &&
    (tag === "" || b.tags.includes(tag))
  )

  const handleDelete = async (id) => {
    await fetch(`/api/bookmarks/${id}`, { method: "DELETE" })
    setBookmarks(prev => prev.filter(b => b.id !== id))
  }

  if (loading) return <p>Loading...</p>

  return (
    <div>
      {/* 検索UI、一覧表示、削除ボタン... */}
    </div>
  )
}
```

状態管理、データ取得、フィルタリング、ミューテーション、UI — 全部が 1 ファイルに混ざっている。次に AI に別のページを書かせたら、また違う構造のコードが出てくる。

Orbit で同じページを書くとこうなる:

```tsx
// page.tsx
export default function Bookmarks() {
  // State — URL から状態を読む
  const [search, setSearch] = useBookmarkSearch()

  // Fetch — データを取得する
  const { data: bookmarks } = useBookmarks()
  const { data: tags } = useTags()

  // Transform — フィルタリング
  const filtered = filterBookmarks(bookmarks ?? [], search.q, search.tag)

  // Mutate — 削除操作
  const { mutate: remove } = useDeleteBookmark()

  // Render
  return (
    <div>
      {/* 検索UI、一覧表示、削除ボタン... */}
    </div>
  )
}
```

上から下に読めば、このページが何をしているか全部わかる。State → Fetch → Transform → Mutate → Render。どのページも同じ流れだ。

「中身はどこにあるの？」と思うかもしれない。hooks.ts に書いてある:

```ts
// hooks.ts
export function useBookmarks() {
  return useQuery({
    key: ["bookmarks"],
    fn: ({ signal }) => getBookmarks(signal),
  })
}

export function useDeleteBookmark() {
  return useMutation({
    fn: (id: string) => deleteBookmark(id),
    invalidate: ["bookmarks"],
  })
}

export function filterBookmarks(bookmarks, q, tag) {
  let result = bookmarks
  if (q) result = result.filter(b => b.title.includes(q) || b.url.includes(q))
  if (tag) result = result.filter(b => b.tags.includes(tag))
  return result
}
```

データアクセスの実体は server.ts に:

```ts
// server.ts
export async function getBookmarks(signal?: AbortSignal): Promise<Bookmark[]> {
  const res = await fetch("/api/bookmarks", { signal })
  return res.json()
}

export async function deleteBookmark(id: string): Promise<void> {
  await fetch(`/api/bookmarks/${id}`, { method: "DELETE" })
}
```

4 つのファイルが、それぞれ 1 つの責務を持つ:

```
server.ts  → 何ができるか（データアクセス）
hooks.ts   → どう使うか（React との接続）
page.tsx   → 何を表示するか（UI の構成）
schema.ts  → データの形は何か（型とバリデーション）
```

AI に「ブックマーク一覧ページを作って」と言っても、「ユーザー管理ページを作って」と言っても、出てくるコードは同じ構造になる。規約が AI の出力を収束させる。

---

## 最初から全部作らなくていい — Progressive Decomposition

「4 ファイルに分けるのは大げさじゃない？」と思ったかもしれない。

安心してほしい。Orbit のデフォルトは常に**粗い粒度**だ。最初は page.tsx だけでいい。

```
最初:          page.tsx だけ
ロジックが膨らんだら:  → hooks.ts に分離
型が増えたら:        → schema.ts に分離
API が生えたら:      → server.ts に分離
```

これを Orbit では **Progressive Decomposition** と呼んでいる。粗い粒度から始めて、必要に応じて分解する。

判断基準はシンプルだ — **page.tsx を「目次」として読めなくなったら、分解する**。

逆に言えば、page.tsx が 30 行で収まるシンプルなページなら、1 ファイルのままでいい。規約は「こうすればうまくいく」という舗装道路であって、「こうしなければならない」という壁ではない。

この考え方はファイル分割だけでなく、あらゆるレイヤーに適用される。ガード（アクセス制御）は最初は layout.tsx に同居させて、複雑になったら guard.ts に分離する。ローディング表示はページ全体の loading.tsx から始めて、部分的に制御したくなったら Suspense boundary を自分で配置する。

1 つの原則を繰り返し適用するだけで、あらゆる設計判断が決まる。

---

## React Compiler への対応

2024 年 10 月、React Compiler が正式にリリースされた。コンポーネントの自動メモ化を行い、不要な再レンダリングを排除してくれる。

しかしリリース直後、多くの既存ライブラリが互換性の壁にぶつかった。React Hook Form は Proxy ベースのリアクティビティが Compiler と衝突し、TanStack Table はクラスインスタンスのメモ化で問題が発生した。後から互換性を確保するのは、設計を根本から見直す必要があり、簡単ではない。

Orbit はこの問題を最初から回避している。React Compiler が前提とする Rules of React に厳密に従って設計した:

- **`useSyncExternalStore`** で外部ストアと同期する
- **Proxy** ベースのリアクティビティを使わない
- **クラスインスタンス**を hooks 内で露出しない
- hooks の戻り値を後から変更しない

結果として、`useCallback`、`useMemo`、`React.memo` を一切書く必要がない。Compiler がすべて自動で処理する。

後追いで互換性に苦しむのではなく、設計段階で解決する。これも「読みやすさ」の一部だと思っている — パフォーマンスチューニングのコードが消えること自体が、コードの読みやすさに貢献する。

---

## これから

Orbit は現在 v0.x で、個人開発者や小規模チームをターゲットにしている。

今後の方向性としては:

- **SSR 対応** — server.ts をサーバーで実行する仕組み。ファイル規約はそのまま、server.ts の実行場所だけが変わる設計
- **scaffold** — パターンが十分に固まったら、コマンド一発で規約に沿った雛形を生成する
- **実アプリでの検証を継続** — 規約が本当に機能するか、使い続けて磨いていく

まだ発展途上だけど、「AI 時代のフロントエンド開発はこうあるべきだ」という仮説に対して、自分なりの答えを形にした。

GitHub: https://github.com/ashunar0/orbit

触ってみて、感想をもらえたら嬉しいです。
