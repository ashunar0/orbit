# Orbit Query — 設計ドキュメント

## ポジション

SWR の書き心地 + TanStack Query の配列キー + Orbit Router 統合。
最小限から始め、足りなければ TanStack Query に移行できる設計にする。

## 設計原則

- **正しい書き方が1つしかない** — API の自由度を絞り、AI 生成コード・人間のコード双方で一貫性を保つ
- **デフォルトが賢い** — staleTime 等のチューニングは必要になるまで不要
- **明示的** — 魔法を避ける。何が起きてるかコードを読めばわかる
- **React Compiler 互換** — Rules of React に厳密に従い、自動メモ化と完全共存する
- **YAGNI** — 楽観的更新、devtools、infinite query 等は v1 スコープ外

## API 設計

### useQuery

```ts
const { data, error, isLoading, isFetching, refetch } = useQuery({
  key: ["users"],
  fn: fetchUsers,
});
```

| 返り値       | 型               | 意味                     |
| ------------ | ---------------- | ------------------------ |
| `data`       | `T \| undefined` | 取得したデータ           |
| `error`      | `Error \| null`  | エラー                   |
| `isLoading`  | `boolean`        | 初回読み込み中           |
| `isFetching` | `boolean`        | バックグラウンド再取得中 |
| `refetch`    | `() => void`     | 手動再取得               |

#### オプション（将来拡張用）

| オプション        | 型                                             | 説明                                  |
| ----------------- | ---------------------------------------------- | ------------------------------------- |
| `key`             | `readonly unknown[]`                           | **必須**。キャッシュの識別子          |
| `fn`              | `(ctx: { signal: AbortSignal }) => Promise<T>` | **必須**。データ取得関数              |
| `staleTime`       | `number`                                       | キャッシュを fresh とみなす時間（ms） |
| `refetchInterval` | `number`                                       | バックグラウンド再取得の間隔（ms）    |
| `enabled`         | `boolean`                                      | false で自動フェッチを抑制            |

### useMutation

```ts
const { mutate, isSubmitting, error } = useMutation({
  fn: createUser,
  invalidate: ["users"],
});

mutate({ name: "あさひ", email: "asahi@example.com" });
```

| 返り値         | 型                                    | 意味          |
| -------------- | ------------------------------------- | ------------- |
| `mutate`       | `(input: TInput) => Promise<TOutput>` | mutation 実行 |
| `isSubmitting` | `boolean`                             | 送信中か      |
| `error`        | `Error \| null`                       | エラー        |

#### オプション

| オプション   | 型                                    | 説明                                     |
| ------------ | ------------------------------------- | ---------------------------------------- |
| `fn`         | `(input: TInput) => Promise<TOutput>` | **必須**。mutation 関数                  |
| `invalidate` | `unknown[]`                           | 成功後に無効化するキー（前方一致）       |
| `onSuccess`  | `(data: TOutput) => void`             | 成功時コールバック（楽観的更新の逃げ道） |

### QueryClient

```ts
const queryClient = createQueryClient();
```

| メソッド                  | 説明                                           |
| ------------------------- | ---------------------------------------------- |
| `fetchQuery(options)`     | データ取得 + キャッシュ格納（loader 内で使う） |
| `invalidate(key)`         | キーの前方一致でキャッシュ無効化               |
| `getQueryData(key)`       | キャッシュを直接読む                           |
| `setQueryData(key, data)` | キャッシュを直接書く                           |

> **注意**: `new QueryClient()` ではなく `createQueryClient()` ファクトリ関数を使う。
> クラスインスタンスは React Compiler がメモ化できず poisoning effect を起こすため、
> 内部はプレーンオブジェクト + クロージャで構成する。

### QueryProvider

```tsx
import { createQueryClient, QueryProvider } from "orbit-query";

const queryClient = createQueryClient();

function App() {
  return (
    <QueryProvider client={queryClient}>
      <Router routes={routes} />
    </QueryProvider>
  );
}
```

## キー設計

- **配列ベース** — 前方一致 invalidation のため
- **規約**: `[リソース名, id?, フィルタ?]` の順

```ts
["users"][("users", "123")][("users", { status: "active" })]; // 一覧 // 詳細 // フィルタ付き
```

- codegen 時は `[httpMethod, ...pathSegments, params?]` も許容

## queryOptions パターン（推奨）

query 定義を集約し、key の一貫性と可読性を保つ：

```ts
// src/queries/users.ts
export const usersQuery = () => ({
  key: ["users"] as const,
  fn: fetchUsers,
});

export const userQuery = (id: string) => ({
  key: ["users", id] as const,
  fn: ({ signal }) => fetchUser(id, { signal }),
});
```

```ts
// 使う側
const { data } = useQuery(usersQuery());
```

## Orbit Router 統合

### loader → query キャッシュ連携（手動方式）

```ts
// loader.ts
import { queryClient } from "@/query-client";
import { usersQuery } from "@/queries/users";

export const loader = async ({ signal }: LoaderArgs) => {
  return queryClient.fetchQuery({
    ...usersQuery(),
    signal,
  });
};
```

```tsx
// page.tsx — loader がキャッシュ済みなので即返る
const { data } = useQuery(usersQuery());
```

ナビゲーション時は loader が先行フェッチし、コンポーネント内では useQuery がキャッシュを返す。
ウォーターフォールを防ぎつつ、コンポーネント内での再フェッチ・キャッシュ共有も可能。

### action 後の自動 invalidation

```ts
const { mutate } = useMutation({
  fn: createUser,
  invalidate: ["users"], // 成功後に自動で再フェッチ
});
```

## React Compiler 互換の実装ガイドライン

React Compiler は hooks の戻り値やオブジェクトを自動メモ化する。
既存ライブラリ（React Hook Form 等）が互換性問題を抱えた根本原因を踏まえ、以下を厳守する。

### 必須ルール

1. **`useSyncExternalStore` でキャッシュと同期する**
   - useQuery / useMutation の内部でキャッシュ（外部ストア）の変更を React に通知する唯一の方法
   - React 公式 API なので Compiler との互換性が保証される
   - `subscribe` + `getSnapshot` のペアで実装する

2. **hooks の戻り値を後から変更しない（不変性）**
   - React Hook Form が壊れた最大の原因。Compiler がメモ化した値を内部で書き換えると更新が反映されない
   - 状態が変わったら `useSyncExternalStore` 経由で新しいオブジェクトを返す

3. **Proxy ベースのリアクティビティを使わない**
   - Proxy で購読を管理するパターンは Compiler のメモ化と根本的に相性が悪い
   - 「明示的」の設計原則とも一致する

4. **クラスインスタンスを hooks 内で露出しない**
   - `new Class()` で作ったインスタンスは Compiler がメモ化できず、依存する全ての式が連鎖的に最適化無効化される（poisoning effect）
   - QueryClient はファクトリ関数 `createQueryClient()` でプレーンオブジェクトを返す

5. **レンダリング中に副作用を起こさない**
   - subscription の登録、fetch の発火等は `useEffect` 内で行う
   - `useSyncExternalStore` の `subscribe` は React が管理するので安全

### useQuery の内部実装イメージ

```ts
function useQuery<T>(options: QueryOptions<T>) {
  const client = useQueryClient();

  // ✅ useSyncExternalStore = Compiler safe
  const snapshot = useSyncExternalStore(
    (onStoreChange) => client.subscribe(options.key, onStoreChange),
    () => client.getSnapshot(options.key),
  );

  // ✅ useEffect 内で fetch を発火（レンダリング中の副作用を回避）
  useEffect(() => {
    if (options.enabled === false) return;
    client.ensureFetch(options);
  }, [client, options.key, options.enabled]);

  // ✅ refetch は外部ストア由来の安定参照
  //    毎レンダリングで新しい関数を作らず、client 側で保持する
  const refetch = client.getRefetch(options.key);

  // ✅ 毎回新しいオブジェクトを返す（不変性を保証）
  return {
    data: snapshot.data as T | undefined,
    error: snapshot.error,
    isLoading: snapshot.status === "loading",
    isFetching: snapshot.isFetching,
    refetch,
  };
}
```

### 既存ライブラリの失敗から学ぶ教訓

| ライブラリ      | 問題                                                       | Orbit Query での回避策                     |
| --------------- | ---------------------------------------------------------- | ------------------------------------------ |
| React Hook Form | Proxy で購読管理 → Compiler がメモ化すると購読パスが壊れる | Proxy 不使用、useSyncExternalStore で同期  |
| React Hook Form | hooks 戻り値を内部変更 → メモ化で更新が反映されない        | 戻り値は常に新しいオブジェクト             |
| TanStack Table  | クラスインスタンスのメモ化失敗 → 連鎖的最適化無効化        | createQueryClient() でプレーンオブジェクト |

## v1 スコープ外（将来検討）

- 楽観的更新（onSuccess + setQueryData で手動対応は可能）
- infinite query / pagination ヘルパー
- devtools
- orbit-query-codegen（OpenAPI → query 定義の自動生成）
- パッケージ分離（orbit-query / orbit-router-query）

## 設計判断ログ

| 判断                   | 結論                                               | 理由                                                                                           |
| ---------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| key の形式             | 配列                                               | 前方一致 invalidation が必要。codegen にも対応可能                                             |
| useQuery の引数        | オブジェクト                                       | TanStack Query が位置引数→オブジェクトに移行した教訓。オプション追加時に破綻しない             |
| useQuery の返り値      | 5つ（data, error, isLoading, isFetching, refetch） | SWR と同等。TanStack Query の20+は過剰                                                         |
| useMutation            | 提供する                                           | 手動 invalidation は散らばって辛い。宣言的に invalidate キーを指定                             |
| invalidation 方式      | 再フェッチ（楽観的更新ではない）                   | シンプルで安全。楽観的更新は onSuccess で逃げ道だけ残す                                        |
| loader 連携            | 手動（queryClient.fetchQuery）                     | 半自動は複数 API で破綻、全自動はウォーターフォール。明示的が一番                              |
| queryOptions パターン  | 公式推奨                                           | AI 生成コードの key ブレ防止。可読性向上                                                       |
| QueryClient の形式     | ファクトリ関数（`createQueryClient()`）            | クラスインスタンスは React Compiler の poisoning effect を起こす。プレーンオブジェクトなら安全 |
| キャッシュ同期方式     | `useSyncExternalStore`                             | React 公式 API で Compiler 互換が保証される。Proxy や内部 mutation に頼らない                  |
| Proxy リアクティビティ | 不使用                                             | React Hook Form の互換性崩壊の根本原因。「明示的」原則とも一致                                 |
