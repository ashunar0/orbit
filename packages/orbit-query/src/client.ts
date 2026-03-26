import type { QueryClient, QueryKey, QueryOptions, QueryState } from "./types"

function serializeKey(key: QueryKey): string {
  return JSON.stringify(key)
}

function matchesPrefix(target: QueryKey, prefix: unknown[]): boolean {
  if (prefix.length > target.length) return false
  return JSON.stringify(prefix) === JSON.stringify(target.slice(0, prefix.length))
}

interface CacheEntry {
  state: QueryState
  updatedAt: number
  subscribers: Set<() => void>
  abortController: AbortController | null
  refetch: () => void
}

const INITIAL_STATE: QueryState = {
  data: undefined,
  error: null,
  status: "idle",
  isFetching: false,
}

export function createQueryClient(): QueryClient {
  const cache = new Map<string, CacheEntry>()

  function getEntry(key: QueryKey): CacheEntry {
    const hash = serializeKey(key)
    let entry = cache.get(hash)
    if (!entry) {
      entry = {
        state: { ...INITIAL_STATE },
        updatedAt: 0,
        subscribers: new Set(),
        abortController: null,
        refetch: () => {
          // 初期状態では noop、fetchQuery 後に上書きされる
        },
      }
      cache.set(hash, entry)
    }
    return entry
  }

  function notify(entry: CacheEntry) {
    for (const cb of entry.subscribers) {
      cb()
    }
  }

  function setState(key: QueryKey, entry: CacheEntry, patch: Partial<QueryState>) {
    entry.state = { ...entry.state, ...patch }
    notify(entry)
  }

  async function executeFetch<T>(options: QueryOptions<T>, signal?: AbortSignal): Promise<T> {
    const entry = getEntry(options.key)

    // 進行中のフェッチをキャンセル
    if (entry.abortController) {
      entry.abortController.abort()
    }

    const controller = new AbortController()
    entry.abortController = controller

    // 外部 signal（loader の AbortSignal 等）と内部 signal を連携
    if (signal) {
      signal.addEventListener("abort", () => controller.abort(), { once: true })
    }

    const isFirstLoad = entry.state.status === "idle" || entry.state.status === "loading"
    setState(options.key, entry, {
      status: isFirstLoad ? "loading" : entry.state.status,
      isFetching: true,
    })

    try {
      const data = await options.fn({ signal: controller.signal })

      if (!controller.signal.aborted) {
        setState(options.key, entry, {
          data,
          error: null,
          status: "success",
          isFetching: false,
        })
        entry.updatedAt = Date.now()
      }

      return data
    } catch (err) {
      if (!controller.signal.aborted) {
        setState(options.key, entry, {
          error: err instanceof Error ? err : new Error(String(err)),
          status: "error",
          isFetching: false,
        })
      }
      throw err
    } finally {
      if (entry.abortController === controller) {
        entry.abortController = null
      }
    }
  }

  const client: QueryClient = {
    async fetchQuery<T>(options: QueryOptions<T> & { signal?: AbortSignal }): Promise<T> {
      return executeFetch(options, options.signal)
    },

    invalidate(key: unknown[]) {
      for (const [hash, entry] of cache) {
        const parsedKey = JSON.parse(hash) as QueryKey
        if (matchesPrefix(parsedKey, key)) {
          // stale にしてリフェッチ
          entry.updatedAt = 0
          // subscriber がいる（= マウント中の useQuery がある）場合のみリフェッチ
          if (entry.subscribers.size > 0) {
            entry.refetch()
          }
        }
      }
    },

    getQueryData<T>(key: QueryKey): T | undefined {
      const entry = cache.get(serializeKey(key))
      return entry?.state.data as T | undefined
    },

    setQueryData<T>(key: QueryKey, data: T) {
      const entry = getEntry(key)
      setState(key, entry, {
        data,
        error: null,
        status: "success",
        isFetching: false,
      })
      entry.updatedAt = Date.now()
    },

    subscribe(key: QueryKey, callback: () => void): () => void {
      const entry = getEntry(key)
      entry.subscribers.add(callback)
      return () => {
        entry.subscribers.delete(callback)
      }
    },

    getSnapshot<T>(key: QueryKey): QueryState<T> {
      const entry = cache.get(serializeKey(key))
      if (!entry) return INITIAL_STATE as QueryState<T>
      return entry.state as QueryState<T>
    },

    ensureFetch<T>(options: QueryOptions<T>) {
      const entry = getEntry(options.key)
      const staleTime = options.staleTime ?? 0
      const isStale = Date.now() - entry.updatedAt >= staleTime
      const isIdle = entry.state.status === "idle"

      // refetch 関数を登録（invalidate 時に呼ばれる）
      entry.refetch = () => {
        // エラーは state に反映済みなので rejection は握りつぶす
        executeFetch(options).catch(() => {})
      }

      if (isIdle || (isStale && !entry.state.isFetching)) {
        // fire-and-forget: エラーは state 経由で通知
        executeFetch(options).catch(() => {})
      }
    },

    getRefetch(key: QueryKey): () => void {
      const entry = getEntry(key)
      return () => entry.refetch()
    },
  }

  return client
}
