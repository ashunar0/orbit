import { useCallback, useSyncExternalStore } from "react"
import type { FormStore } from "./types"

export interface UseFieldReturn<T> {
  value: T
  error: string | undefined
  touched: boolean
  setValue: (value: T) => void
  setTouched: () => void
  props: {
    value: T
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    onBlur: () => void
  }
}

export function useField<TInput extends Record<string, unknown>, TOutput, K extends keyof TInput & string>(
  store: FormStore<TInput, TOutput>,
  name: K,
): UseFieldReturn<TInput[K]> {
  // フィールド単位の購読 — このフィールドが変わったときだけ再レンダリング
  const snapshot = useSyncExternalStore(
    (cb) => store.subscribeField(name, cb),
    () => store.getFieldSnapshot(name),
  )

  const setValue = useCallback(
    (value: TInput[K]) => store.setValue(name, value),
    [store, name],
  )

  const setTouched = useCallback(
    () => {
      store.setTouched(name)
      store.validateField(name)
    },
    [store, name],
  )

  // input/textarea/select にそのまま渡せる props
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      store.setValue(name, e.target.value as TInput[K])
    },
    [store, name],
  )

  return {
    value: snapshot.value,
    error: snapshot.error,
    touched: snapshot.touched,
    setValue,
    setTouched,
    props: {
      value: snapshot.value,
      onChange,
      onBlur: setTouched,
    },
  }
}
