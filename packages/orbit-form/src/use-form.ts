import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import type { ZodType, ZodTypeDef } from "zod"
import { createFormStore } from "./store"
import type { DependencyCallback, FormStore } from "./types"

export interface UseFormOptions<TInput extends Record<string, unknown>, TOutput> {
  schema: ZodType<TOutput, ZodTypeDef, TInput>
  defaultValues: TInput | undefined
  dependencies?: { [K in keyof TInput]?: DependencyCallback<TInput> }
}

export interface UseFormReturn<TInput extends Record<string, unknown>, TOutput> {
  store: FormStore<TInput, TOutput>
  values: TInput
  errors: { [K in keyof TInput]?: string } & { _root?: string }
  isDirty: boolean
  isSubmitting: boolean
  submit: (onSubmit: (data: TOutput) => void | Promise<void>) => (e?: React.FormEvent) => void
  reset: (name?: keyof TInput) => void
}

export function useForm<TInput extends Record<string, unknown>, TOutput>(
  options: UseFormOptions<TInput, TOutput>,
): UseFormReturn<TInput, TOutput> {
  const { schema, defaultValues, dependencies } = options

  // defaultValues が undefined の間は空のストアを使わない
  // → orbit-query からの非同期データ到着を待つ
  const hasValues = defaultValues !== undefined

  // store は defaultValues が確定したら1回だけ作る
  // defaultValues が変わったら resetAll で反映（store は再作成しない）
  const storeRef = useRef<FormStore<TInput, TOutput> | null>(null)

  if (hasValues && !storeRef.current) {
    storeRef.current = createFormStore({ schema, defaultValues, dependencies })
  }

  // defaultValues が変わったとき（非同期データ到着）に resetAll
  const prevDefaultsRef = useRef(defaultValues)
  useEffect(() => {
    if (defaultValues === undefined) return
    if (prevDefaultsRef.current === defaultValues) return
    prevDefaultsRef.current = defaultValues

    if (storeRef.current) {
      storeRef.current.resetAll(defaultValues)
    } else {
      storeRef.current = createFormStore({ schema, defaultValues, dependencies })
    }
  }, [defaultValues, schema, dependencies])

  const store = storeRef.current

  // useSyncExternalStore でフォーム全体を購読
  const snapshot = useSyncExternalStore(
    (cb) => store?.subscribe(cb) ?? (() => {}),
    () => store?.getSnapshot() ?? EMPTY_STATE as ReturnType<NonNullable<typeof store>["getSnapshot"]>,
  )

  // submit ハンドラ — 安定参照
  const onSubmitRef = useRef<((data: TOutput) => void | Promise<void>) | null>(null)

  const submit = useMemo(() => {
    return (onSubmit: (data: TOutput) => void | Promise<void>) => {
      onSubmitRef.current = onSubmit
      return (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!store) return

        const data = store.validate()
        if (data === null) return

        store.setSubmitting(true)
        const result = onSubmitRef.current?.(data)
        if (result instanceof Promise) {
          result.finally(() => store.setSubmitting(false))
        } else {
          store.setSubmitting(false)
        }
      }
    }
  }, [store])

  const reset = useMemo(() => {
    return (name?: keyof TInput) => {
      store?.reset(name)
    }
  }, [store])

  return {
    store: store!,
    values: snapshot.values,
    errors: snapshot.errors,
    isDirty: snapshot.isDirty,
    isSubmitting: snapshot.isSubmitting,
    submit,
    reset,
  }
}

const EMPTY_STATE = {
  values: {} as Record<string, unknown>,
  errors: {},
  touched: {},
  isDirty: false,
  isSubmitting: false,
}
