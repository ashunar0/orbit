# React Compilerでフォームが壊れる — React Hook Formの内部設計から理解する互換性問題

React Compiler を導入したら、フォームが動かなくなった。

`watch()` で取得した値が更新されない。バリデーションエラーが表示されない。`reset()` を呼んでもフォームがクリアされない。

自分のコードにバグがあるのかと思って調べた。違った。**React Hook Form の設計そのものが、React Compiler の前提と矛盾している。**

この記事では、React Compiler が内部で何をしているのかを理解した上で、なぜ React Hook Form をはじめとする既存ライブラリが壊れるのか、その技術的な原因を解説する。

---

## React Compiler は何をしているか

React Compiler（`babel-plugin-react-compiler`）は、コンポーネントや hooks の出力を**自動的にメモ化**する Babel プラグインだ。

2025 年 10 月に v1.0 がリリースされ、2026 年 3 月現在、npm の月間ダウンロードは 2,500 万を超えている。React 19 ユーザーの約半数が既に導入しているとされ、もはや「将来の話」ではない。

### 何が変わるのか

これまで開発者が手動で書いていた `useMemo`、`useCallback`、`React.memo` を、コンパイラが自動で挿入してくれる。

具体的には、コンパイラはコンポーネント内の各式を解析し、**依存する値が変わっていなければ再計算をスキップする**コードを生成する。

```tsx
// 開発者が書いたコード
function Greeting({ name }) {
  const message = `Hello, ${name}!`
  return <p>{message}</p>
}

// コンパイラが生成するコード（概念的に）
function Greeting({ name }) {
  const $ = _c(4)            // 4 スロットのキャッシュ配列を確保

  let message
  if ($[0] !== name) {       // name が前回と違う？
    message = `Hello, ${name}!`
    $[0] = name              // 依存値を保存
    $[1] = message           // 計算結果を保存
  } else {
    message = $[1]           // キャッシュから返す
  }

  let t0
  if ($[2] !== message) {    // JSX の依存値が変わった？
    t0 = <p>{message}</p>
    $[2] = message
    $[3] = t0
  } else {
    t0 = $[3]
  }
  return t0
}
```

`_c` は `useMemoCache` を呼び出すヘルパーで、コンポーネントごとにフラットなキャッシュ配列を確保する。各スロットに依存値と計算結果のペアを保存し、**`!==`（厳密な参照比較）で変化を検出する。**

ここが重要だ。コンパイラは**オブジェクトの参照が変わったかどうか**だけを見る。中身は見ない。

### もう少し複雑な例

hooks の戻り値に対しても同じことが起きる。

```tsx
// 開発者が書いたコード
function Profile() {
  const user = useUser()
  return <div>{user.name}</div>
}

// コンパイラが生成するコード（概念的に）
function Profile() {
  const $ = _c(4)
  const user = useUser()

  let t0
  if ($[0] !== user.name) {
    t0 = user.name
    $[0] = user.name
    $[1] = t0
  } else {
    t0 = $[1]
  }

  let t1
  if ($[2] !== t0) {
    t1 = <div>{t0}</div>
    $[2] = t0
    $[3] = t1
  } else {
    t1 = $[3]
  }
  return t1
}
```

`useUser()` が**新しいオブジェクト参照**を返せば `user.name` の比較が走る。しかし、もし `useUser()` が**毎回同じオブジェクト参照**を返して中身だけ変えていたら、コンパイラはキャッシュを使い続ける。**値が変わったことに気づけない。**

これが、これから説明する問題の核心だ。

---

## コンパイラが前提とする「React のルール」

コンパイラの最適化が正しく動くために、3 つの前提がある。

### 1. コンポーネントと hooks は純粋関数である

同じ props、state、context が渡されたら、同じ結果を返す。レンダリング中に外部の変更可能な値を読まない。

### 2. hooks の戻り値は不変（immutable）である

hooks から返されたオブジェクトは、返された後に変更されない。値が変わる場合は、**新しいオブジェクト参照**を返す。

### 3. Ref はレンダリング中に読まない

`useRef` の `.current` はレンダリング中にアクセスしてはいけない。Ref はイベントハンドラや Effect の中で使うもの。

これらは React Compiler のために新しく作られたルールではない。React が以前から公式に定めていた「Rules of React」そのものだ。ただし、これまでは破っても動いていた。コンパイラの登場で、**ルール違反が実際にバグとして顕在化するようになった。**

---

## なぜ React Hook Form は壊れるのか

React Hook Form（RHF）は、上記 3 つのルールすべてに違反している。

### 違反 1: Interior Mutability（内部変更可能性）

RHF の `useForm()` は、内部的に `useRef` でフォームの状態を保持している。

```ts
// React Hook Form の useForm 内部（簡略化）
const _formControl = React.useRef(undefined)
// ...
return _formControl.current  // 毎回同じオブジェクト参照を返す
```

フォームの値が変わっても、エラーが増えても、`useForm()` が返すオブジェクトの**参照は変わらない**。中身だけが変わる。

コンパイラから見ると：

```tsx
const form = useForm(...)
const value = form.watch("email")

// コンパイラの変換（概念的に）:
const form = useForm(...)
let value
if ($[0] !== form) {        // form は毎回同じ参照
  value = form.watch("email")
  $[0] = form
  $[1] = value
} else {
  value = $[1]              // 永遠にキャッシュが返る
}
```

`form` の参照は絶対に変わらないから、`watch("email")` は**初回の値がキャッシュされたまま二度と更新されない。**

React 公式チームの josephsavona 氏もこの問題を確認し、「`watch()` API は state を使って React に変更を通知していないため、React のルールに違反している」と明言している。

### 違反 2: Getter による暗黙的な購読

RHF の `formState` は、`Object.defineProperty` の getter を使って「どのプロパティにアクセスしたか」を追跡している。

```ts
// React Hook Form の getProxyFormState.ts（簡略化）
Object.defineProperty(result, key, {
  get: () => {
    // 副作用: このプロパティを購読リストに登録
    control._proxyFormState[key] = true
    // 内部状態から現在の値を返す
    return formState[key]
  },
})
```

プロパティを**読む**だけで、裏側で**購読の登録**が行われる。これはレンダリング中の暗黙的な副作用だ。

コンパイラはこの仕組みを認識できない。プロパティの読み取りは純粋な操作として扱い、結果をキャッシュする。getter が呼ばれなくなるため、購読が成立しなくなり、**`formState.errors` や `formState.isDirty` が更新されなくなる。**

### 違反 3: レンダリング中の Ref 読み取り

RHF の `useForm.ts` は、レンダリング中に `ref.current` を大量に読み取っている。`eslint-plugin-react-compiler` を走らせると、**15 件以上の違反**が検出される。

```
/src/useForm.ts
  76:8   error  Ref values (the `current` property) may not be accessed during render
  77:5   error  Ref values (the `current` property) may not be accessed during render
  84:3   error  Ref values (the `current` property) may not be accessed during render
  // ... 12件以上続く
```

Ref はコンパイラが追跡できないミュータブルな値だ。レンダリング中にこれを読むと、コンパイラは正しくキャッシュを無効化できない。

### 壊れる API 一覧

| 壊れる API | ワークアラウンド | 備考 |
|---|---|---|
| `form.watch('field')` | `useWatch({ name, control })` に置換 | hook ベースなら動く |
| `form.watch()`（全フィールド） | `useWatch({ control })` に置換 | 同上 |
| `formState.errors` | `useFormState({ control })` に置換 | hook ベースの state 参照 |
| `formState.isDirty` | `useFormState({ control })` に置換 | 同上 |
| `<Controller>` | `'use no memo'` ディレクティブ | 代替なし |
| `useController` | `'use no memo'` ディレクティブ | 代替なし |
| `reset()` | `'use no memo'` ディレクティブ | 代替なし |

ワークアラウンドが「`'use no memo'`（このコンポーネントのメモ化を無効化する）」しかない API が多い。つまり、**コンパイラの恩恵を受けながら RHF を使うことは、現時点では難しい。**

RHF v8 で対応が進められているが、まだベータ段階だ。

---

## React Hook Form だけの問題ではない

Interior mutability による互換性問題は、RHF に限らない。

### 壊れるライブラリたち

**TanStack Table** — `useReactTable()` が返すテーブルインスタンスが内部変更可能。React 公式の非互換リストに**ハードコードされている**。v9 で対応予定だがまだ alpha。

**TanStack Virtual** — 同じ理由で公式非互換リスト入り。`useVirtualizer()` の戻り値が内部変更可能。

**MobX** — Observable mutation という概念そのものがコンパイラと矛盾する。`observer()` でラップされたコンポーネントは最適化が完全にスキップされる。メンテナーの mweststrate 氏も「根本的に相反するモデル」と認めている。

**TanStack Form** — `field.state` の interior mutability で問題が発生。修正 PR がマージされたが、React チームから非互換リストへの追加を提案されている。

### 壊れないライブラリたち

一方で、問題なく動くライブラリもある。

**Zustand** — `useSyncExternalStore` ベース。外部ストアの変更を immutable な snapshot として返すため、コンパイラの参照比較と完全に噛み合う。

**Jotai** — atoms の値を immutable に返す設計。軽微な修正のみで対応完了。

**TanStack Query** — データの参照安定性を意識した設計。コンパイラとの互換性問題は確認されていない。

### パターンは明確

| | 壊れる | 壊れない |
|---|---|---|
| **設計** | 同じ参照を返して中身を変える | 中身が変わったら新しい参照を返す |
| **状態通知** | Proxy / getter / ref で暗黙的に | `useSyncExternalStore` で明示的に |
| **React のルール** | 違反している（が、今まで動いていた） | 準拠している |

---

## useSyncExternalStore — コンパイラ時代の正しいパターン

壊れないライブラリに共通するのが `useSyncExternalStore` の使用だ。React 18 で追加されたこの hook は、外部の状態を React に安全に接続するための公式 API だ。

```ts
const snapshot = useSyncExternalStore(subscribe, getSnapshot)
```

仕組みはシンプルだ:

1. 外部ストアの値が変わったら、`subscribe` で渡された callback を呼ぶ
2. React が `getSnapshot()` を呼んで新しい snapshot を取得する
3. 前回の snapshot と `Object.is()` で比較し、**異なれば再レンダリング**する

ポイントは、`getSnapshot()` が**データが変わったときだけ新しい参照を返す**こと。データが変わらなければ同じ参照を返す。これがコンパイラの `!==` 比較と完全に一致する。

### useSyncExternalStore を使ったフォームの設計

この原則に従うと、フォームライブラリはこう設計できる:

```ts
// ストア: React の外に状態を持つ
function createFormStore(options) {
  let values = { ...options.defaultValues }
  let errors = {}
  const subscribers = new Set()

  // スナップショットのキャッシュ
  let cachedSnapshot = null

  function notify() {
    cachedSnapshot = null                 // キャッシュを無効化
    for (const cb of subscribers) cb()    // React に変更を通知
  }

  return {
    setValue(name, value) {
      values[name] = value
      notify()
    },

    // データが変わったら新しいオブジェクトを返す
    // データが変わらなければ同じ参照を返す
    getSnapshot() {
      if (!cachedSnapshot) {
        cachedSnapshot = {
          values: { ...values },
          errors: { ...errors },
        }
      }
      return cachedSnapshot
    },

    subscribe(callback) {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
  }
}
```

```tsx
// hook: useSyncExternalStore で接続
function useForm(options) {
  const store = useRef(null)
  if (!store.current) {
    store.current = createFormStore(options)
  }

  const snapshot = useSyncExternalStore(
    (cb) => store.current.subscribe(cb),
    () => store.current.getSnapshot(),
  )

  return {
    values: snapshot.values,     // immutable な snapshot
    errors: snapshot.errors,     // immutable な snapshot
    register: (name) => ({
      value: snapshot.values[name],
      onChange: (e) => store.current.setValue(name, e.target.value),
    }),
  }
}
```

RHF との決定的な違い:

| | React Hook Form | useSyncExternalStore ベース |
|---|---|---|
| **状態の保持** | `useRef` + interior mutability | 外部ストア + immutable snapshot |
| **変更通知** | Proxy/getter で暗黙的に | `subscribe` + `getSnapshot` で明示的に |
| **hook の戻り値** | 同じ参照（中身が変わる） | **新しい参照**（データが変わったとき） |
| **React Compiler** | キャッシュが無効化されない | キャッシュが正しく無効化される |

`useSyncExternalStore` を使えば、フォームの値が変わるたびに `getSnapshot()` が新しいオブジェクトを返し、コンパイラの `!==` 比較がそれを検出して再レンダリングが走る。Proxy も getter も不要だ。

---

## 後付けでは難しい

RHF がこの問題を簡単に直せない理由がある。

Interior mutability は RHF の**パフォーマンス最適化の中核**だ。オブジェクト参照を変えないことで不要な再レンダリングを防いでいた。それが React Compiler 以前の世界では正しい最適化だった。

しかし、コンパイラが自動でメモ化を行う世界では、この最適化は逆効果になる。**コンパイラに「何も変わっていない」と誤認させる原因になる。**

RHF v8 はこの問題に対応しようとしているが、API の破壊的変更を伴う大規模なリファクタリングが必要であり、まだベータ段階だ。後から Rules of React に準拠させることの難しさを示している。

---

## まとめ

React Compiler の普及により、**「参照は変えずに中身を変える」という設計パターンが通用しなくなった。**

壊れるライブラリに共通するのは interior mutability。壊れないライブラリに共通するのは `useSyncExternalStore` による immutable snapshot パターン。

これはフォームライブラリに限った話ではない。テーブル、状態管理、アニメーション — 外部の状態を React に接続するあらゆるライブラリに影響する。

もし今、React Compiler の導入を検討しているなら、使用しているライブラリの互換性を先に確認することを勧める。そして、もし自分でライブラリや共有 hooks を作るなら、最初から `useSyncExternalStore` と immutable snapshot で設計する方がいい。後から直すのは、想像以上に大変だ。

---

この設計原則を実際に適用したフォームライブラリとして [orbit-form](https://github.com/ashunar0/orbit/tree/main/packages/orbit-form) を公開している。`useSyncExternalStore` ベースで Proxy やクラスインスタンスを一切使わず、React Compiler との完全な互換性を前提に設計した。同じ思想で作ったデータ取得ライブラリ [orbit-query](https://github.com/ashunar0/orbit/tree/main/packages/orbit-query) も合わせて公開している。
