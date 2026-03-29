import type { QueryClient, QueryKey, QueryOptions, QueryState } from "./types";

const UNDEFINED_SENTINEL = "__orbit_undefined__";

/** undefined と null を区別してシリアライズする */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_, v) => {
    if (v === undefined) return UNDEFINED_SENTINEL;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
    }
    return v;
  });
}

function serializeKey(key: QueryKey): string {
  return stableStringify(key);
}

function matchesPrefix(target: QueryKey, prefix: unknown[]): boolean {
  if (prefix.length > target.length) return false;
  return stableStringify(prefix) === stableStringify(target.slice(0, prefix.length));
}

/** subscriber がいなくなってからキャッシュを保持する時間（5分） */
const GC_TIME = 5 * 60 * 1000;

interface CacheEntry {
  key: QueryKey;
  state: QueryState;
  updatedAt: number;
  subscribers: Set<() => void>;
  abortController: AbortController | null;
  /** ���在の options を保持する ref。ensureFetch で更新される */
  currentOptions: QueryOptions | null;
  /** 安���参照の refetch 関数。entry 作成時���1回だけ生成 */
  refetchStable: () => void;
  /** GC タイマー ID */
  gcTimer: ReturnType<typeof setTimeout> | null;
}

const INITIAL_STATE: QueryState = {
  data: undefined,
  error: null,
  status: "idle",
  isFetching: false,
};

export function createQueryClient(): QueryClient {
  const cache = new Map<string, CacheEntry>();
  const noop = () => {};

  /** read-only: レンダリング中に安全に呼べる（Map を変更しない） */
  function peekEntry(key: QueryKey): CacheEntry | undefined {
    return cache.get(serializeKey(key));
  }

  /** get-or-create: subscribe / ensureFetch 等の副作用コンテキストでのみ使う */
  function getEntry(key: QueryKey): CacheEntry {
    const hash = serializeKey(key);
    let entry = cache.get(hash);
    if (!entry) {
      entry = {
        key,
        state: { ...INITIAL_STATE },
        updatedAt: 0,
        subscribers: new Set(),
        abortController: null,
        currentOptions: null,
        // placeholder — 下で上書き
        refetchStable: noop,
        gcTimer: null,
      };
      // entry を closure でキャプチャして安定参照を作る
      const stableEntry = entry;
      entry.refetchStable = () => {
        if (stableEntry.currentOptions) {
          executeFetch(stableEntry.currentOptions).catch(() => {});
        }
      };
      cache.set(hash, entry);
    }
    return entry;
  }

  function notify(entry: CacheEntry) {
    for (const cb of entry.subscribers) {
      cb();
    }
  }

  function setState(key: QueryKey, entry: CacheEntry, patch: Partial<QueryState>) {
    entry.state = { ...entry.state, ...patch };
    notify(entry);
  }

  async function executeFetch<T>(options: QueryOptions<T>, signal?: AbortSignal): Promise<T> {
    const entry = getEntry(options.key);

    // 進行中のフェッチをキャンセル
    if (entry.abortController) {
      entry.abortController.abort();
    }

    const controller = new AbortController();
    entry.abortController = controller;

    // 外部 signal（loader の AbortSignal 等）と内部 signal を連携
    if (signal) {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const isFirstLoad = entry.state.status === "idle" || entry.state.status === "loading";
    setState(options.key, entry, {
      status: isFirstLoad ? "loading" : entry.state.status,
      isFetching: true,
    });

    try {
      const data = await options.fn({ signal: controller.signal });

      if (!controller.signal.aborted) {
        setState(options.key, entry, {
          data,
          error: null,
          status: "success",
          isFetching: false,
        });
        entry.updatedAt = Date.now();
      }

      return data;
    } catch (err) {
      if (!controller.signal.aborted) {
        setState(options.key, entry, {
          error: err instanceof Error ? err : new Error(String(err)),
          status: "error",
          isFetching: false,
        });
      }
      throw err;
    } finally {
      if (entry.abortController === controller) {
        entry.abortController = null;
      }
    }
  }

  const client: QueryClient = {
    async fetchQuery<T>(options: QueryOptions<T> & { signal?: AbortSignal }): Promise<T> {
      return executeFetch(options, options.signal);
    },

    invalidate(key: unknown[]) {
      for (const [, entry] of cache) {
        if (matchesPrefix(entry.key, key)) {
          // stale にし��リフェッチ
          entry.updatedAt = 0;
          // subscriber ��いる（= マウント中の useQuery が���る）場合のみリフェッチ
          if (entry.subscribers.size > 0) {
            entry.refetchStable();
          }
        }
      }
    },

    getQueryData<T>(key: QueryKey): T | undefined {
      const entry = cache.get(serializeKey(key));
      return entry?.state.data as T | undefined;
    },

    setQueryData<T>(key: QueryKey, data: T) {
      const entry = getEntry(key);
      setState(key, entry, {
        data,
        error: null,
        status: "success",
        isFetching: false,
      });
      entry.updatedAt = Date.now();
    },

    subscribe(key: QueryKey, callback: () => void): () => void {
      const hash = serializeKey(key);
      const entry = getEntry(key);
      // subscribe 時に GC タイマーをキャンセル（再マウント対応）
      if (entry.gcTimer !== null) {
        clearTimeout(entry.gcTimer);
        entry.gcTimer = null;
      }
      entry.subscribers.add(callback);
      return () => {
        entry.subscribers.delete(callback);
        // subscriber が 0 になったら GC をスケジュール
        if (entry.subscribers.size === 0) {
          entry.gcTimer = setTimeout(() => {
            if (entry.subscribers.size === 0) {
              cache.delete(hash);
            }
          }, GC_TIME);
        }
      };
    },

    // pure: レンダリング中に呼ばれるため Map を変更しない
    getSnapshot<T>(key: QueryKey): QueryState<T> {
      return (peekEntry(key)?.state ?? INITIAL_STATE) as QueryState<T>;
    },

    ensureFetch<T>(options: QueryOptions<T>) {
      const entry = getEntry(options.key);
      const staleTime = options.staleTime ?? 0;
      const isStale = Date.now() - entry.updatedAt >= staleTime;
      const isIdle = entry.state.status === "idle";

      // Fix #5: options を ref 的に保持。refetchStable が常に最新の options を使う
      entry.currentOptions = options;

      if (isIdle || (isStale && !entry.state.isFetching)) {
        // fire-and-forget: エラーは state 経由で通知
        executeFetch(options).catch(() => {});
      }
    },

    // pure: レンダリング中に呼ばれるため Map を変更しない
    getRefetch(key: QueryKey): () => void {
      return peekEntry(key)?.refetchStable ?? noop;
    },
  };

  return client;
}
