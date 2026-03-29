export type QueryKey = readonly unknown[];

export type QueryStatus = "idle" | "loading" | "success" | "error";

export interface QueryState<T = unknown> {
  data: T | undefined;
  error: Error | null;
  status: QueryStatus;
  isFetching: boolean;
}

export interface QueryOptions<T = unknown> {
  key: QueryKey;
  fn: (ctx: { signal: AbortSignal }) => Promise<T>;
  staleTime?: number;
  refetchInterval?: number;
  enabled?: boolean;
}

export interface MutationOptions<TInput = unknown, TOutput = unknown> {
  fn: (input: TInput) => Promise<TOutput>;
  invalidate?: unknown[];
  onSuccess?: (data: TOutput) => void;
}

/** dehydrate() が返すシリアライズ可能な形式 */
export interface DehydratedState {
  queries: Array<{ key: QueryKey; data: unknown; updatedAt: number }>;
}

export interface QueryClient {
  fetchQuery<T>(options: QueryOptions<T> & { signal?: AbortSignal }): Promise<T>;
  invalidate(key: unknown[]): void;
  getQueryData<T>(key: QueryKey): T | undefined;
  setQueryData<T>(key: QueryKey, data: T): void;
  subscribe(key: QueryKey, callback: () => void): () => void;
  getSnapshot<T>(key: QueryKey): QueryState<T>;
  ensureFetch<T>(options: QueryOptions<T>): void;
  getRefetch(key: QueryKey): () => void;
  /** サーバーで取得したデータをキャッシュに復元する */
  hydrate(state: DehydratedState): void;
  /** キャッシュの成功データをシリアライズ可能な形式で取り出す */
  dehydrate(): DehydratedState;
}
