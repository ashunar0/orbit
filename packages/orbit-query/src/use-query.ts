import { useEffect, useSyncExternalStore } from "react"
import { useQueryClient } from "./provider"
import type { QueryOptions } from "./types"

export function useQuery<T>(options: QueryOptions<T>) {
  const client = useQueryClient()

  // useSyncExternalStore = React Compiler safe
  const snapshot = useSyncExternalStore(
    (onStoreChange) => client.subscribe(options.key, onStoreChange),
    () => client.getSnapshot<T>(options.key),
  )

  // useEffect 内で fetch を発火（レンダリング中の副作用を回避）
  useEffect(() => {
    if (options.enabled === false) return
    client.ensureFetch(options)
  }, [client, serializeKey(options.key), options.enabled])

  // refetchInterval 対応
  useEffect(() => {
    if (options.enabled === false) return
    if (!options.refetchInterval) return

    const id = setInterval(() => {
      client.ensureFetch(options)
    }, options.refetchInterval)

    return () => clearInterval(id)
  }, [client, serializeKey(options.key), options.refetchInterval, options.enabled])

  const refetch = client.getRefetch(options.key)

  return {
    data: snapshot.data as T | undefined,
    error: snapshot.error,
    isLoading: snapshot.status === "loading",
    isFetching: snapshot.isFetching,
    refetch,
  }
}

function serializeKey(key: readonly unknown[]): string {
  return JSON.stringify(key)
}
