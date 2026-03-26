import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import { useQueryClient } from "./provider"
import type { QueryOptions } from "./types"

export function useQuery<T>(options: QueryOptions<T>) {
  const client = useQueryClient()

  // key を安定した文字列に変換（deps で使う）
  const keyString = JSON.stringify(options.key)

  // Fix #5: options を ref で保持し、常に最新を参照できるようにする
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Fix #2: subscribe を useCallback + keyString で安定化
  const subscribe = useCallback(
    (onStoreChange: () => void) => client.subscribe(options.key, onStoreChange),
    [client, keyString],
  )

  const getSnapshot = useCallback(
    () => client.getSnapshot<T>(options.key),
    [client, keyString],
  )

  // useSyncExternalStore = React Compiler safe
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  // useEffect 内で fetch を発火（レンダリング中の副作用を回避）
  useEffect(() => {
    if (optionsRef.current.enabled === false) return
    client.ensureFetch(optionsRef.current)
  }, [client, keyString, options.enabled])

  // refetchInterval 対応
  useEffect(() => {
    if (optionsRef.current.enabled === false) return
    if (!optionsRef.current.refetchInterval) return

    const id = setInterval(() => {
      client.ensureFetch(optionsRef.current)
    }, optionsRef.current.refetchInterval)

    return () => clearInterval(id)
  }, [client, keyString, options.refetchInterval, options.enabled])

  // Fix #3: 安定参照の refetch を取得
  const refetch = client.getRefetch(options.key)

  return {
    data: snapshot.data as T | undefined,
    error: snapshot.error,
    // Fix #6: idle かつ enabled なら loading 扱い（初回マウント時の空状態を防ぐ）
    // enabled: false で idle のままの場合は loading ではない
    isLoading: snapshot.status === "loading" || (snapshot.status === "idle" && options.enabled !== false),
    isFetching: snapshot.isFetching,
    refetch,
  }
}
