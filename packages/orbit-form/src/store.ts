import type { ZodType, ZodTypeDef } from "zod"
import type {
  DependencyCallback,
  FieldErrors,
  FormState,
  FormStore,
  FormStoreOptions,
} from "./types"

export function createFormStore<TInput extends Record<string, unknown>, TOutput>(
  options: FormStoreOptions<TInput, TOutput>,
): FormStore<TInput, TOutput> {
  const { schema, defaultValues, dependencies } = options

  // --- 内部状態 ---
  let values: TInput = { ...defaultValues }
  let errors: FieldErrors<TInput> = {}
  let touched: Record<string, boolean> = {}
  let isDirty = false
  let isSubmitting = false

  // --- 購読管理 ---
  const globalSubscribers = new Set<() => void>()
  const fieldSubscribers = new Map<keyof TInput, Set<() => void>>()

  // --- スナップショットキャッシュ ---
  let cachedSnapshot: FormState<TInput> | null = null
  const cachedFieldSnapshots = new Map<keyof TInput, { value: unknown; error: string | undefined; touched: boolean }>()

  function invalidateSnapshot() {
    cachedSnapshot = null
  }

  function invalidateFieldSnapshot(name: keyof TInput) {
    cachedFieldSnapshots.delete(name)
  }

  function notifyGlobal() {
    invalidateSnapshot()
    for (const cb of globalSubscribers) cb()
  }

  function notifyField(name: keyof TInput) {
    invalidateFieldSnapshot(name)
    const subs = fieldSubscribers.get(name)
    if (subs) {
      for (const cb of subs) cb()
    }
  }

  // --- Zod バリデーション ---
  function runValidation(): { success: true; data: TOutput } | { success: false; errors: FieldErrors<TInput> } {
    const result = (schema as ZodType<TOutput, ZodTypeDef, TInput>).safeParse(values)
    if (result.success) {
      return { success: true, data: result.data }
    }

    const fieldErrors: FieldErrors<TInput> = {}
    for (const issue of result.error.issues) {
      if (issue.path.length === 0) {
        fieldErrors._root = issue.message
      } else {
        const key = issue.path[0] as keyof TInput
        // 最初のエラーだけ保持
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message
        }
      }
    }
    return { success: false, errors: fieldErrors }
  }

  function runFieldValidation(name: keyof TInput) {
    const result = runValidation()
    const prevError = errors[name]
    if (result.success) {
      if (prevError) {
        delete errors[name]
        // _root エラーもクリア
        delete errors._root
        notifyField(name)
        notifyGlobal()
      }
    } else {
      const newError = result.errors[name]
      if (prevError !== newError) {
        if (newError) {
          errors[name] = newError
        } else {
          delete errors[name]
        }
        // _root もセット
        if (result.errors._root) {
          errors._root = result.errors._root
        } else {
          delete errors._root
        }
        notifyField(name)
        notifyGlobal()
      }
    }
  }

  // --- dependencies 実行 ---
  function runDependency(name: keyof TInput) {
    if (!dependencies) return
    const dep = dependencies[name] as DependencyCallback<TInput> | undefined
    if (!dep) return

    dep(values[name], {
      reset: (targetName) => {
        values[targetName] = defaultValues[targetName]
        isDirty = checkDirty()
        invalidateFieldSnapshot(targetName)
        notifyField(targetName)
        notifyGlobal()
      },
      setValue: (targetName, value) => {
        values[targetName] = value as TInput[typeof targetName]
        isDirty = checkDirty()
        invalidateFieldSnapshot(targetName)
        notifyField(targetName)
        notifyGlobal()
      },
    })
  }

  function checkDirty(): boolean {
    for (const key of Object.keys(defaultValues as Record<string, unknown>)) {
      if (values[key as keyof TInput] !== defaultValues[key as keyof TInput]) {
        return true
      }
    }
    return false
  }

  // --- FormStore API ---
  const store: FormStore<TInput, TOutput> = {
    getState() {
      return store.getSnapshot()
    },

    getFieldValue<K extends keyof TInput>(name: K): TInput[K] {
      return values[name]
    },

    getFieldError<K extends keyof TInput>(name: K): string | undefined {
      return errors[name]
    },

    getFieldTouched<K extends keyof TInput>(name: K): boolean {
      return touched[name as string] ?? false
    },

    setValue<K extends keyof TInput>(name: K, value: TInput[K]) {
      values[name] = value
      isDirty = checkDirty()
      invalidateFieldSnapshot(name)
      notifyField(name)
      notifyGlobal()

      // touched なフィールドはバリデーション再実行
      if (touched[name as string]) {
        runFieldValidation(name)
      }

      // dependency 実行
      runDependency(name)
    },

    setTouched<K extends keyof TInput>(name: K, isTouched = true) {
      touched[name as string] = isTouched
      invalidateFieldSnapshot(name)
      notifyField(name)
      notifyGlobal()
    },

    validate(): TOutput | null {
      const result = runValidation()
      if (result.success) {
        errors = {}
        notifyGlobal()
        // 全フィールドの snapshot を無効化
        for (const key of Object.keys(defaultValues as Record<string, unknown>)) {
          invalidateFieldSnapshot(key as keyof TInput)
          notifyField(key as keyof TInput)
        }
        return result.data
      }

      errors = result.errors
      notifyGlobal()
      for (const key of Object.keys(defaultValues as Record<string, unknown>)) {
        invalidateFieldSnapshot(key as keyof TInput)
        notifyField(key as keyof TInput)
      }
      return null
    },

    validateField<K extends keyof TInput>(name: K) {
      runFieldValidation(name)
    },

    reset(name?: keyof TInput) {
      if (name) {
        values[name] = defaultValues[name]
        delete errors[name]
        delete touched[name as string]
        isDirty = checkDirty()
        invalidateFieldSnapshot(name)
        notifyField(name)
        notifyGlobal()
      } else {
        store.resetAll()
      }
    },

    resetAll(newValues?: TInput) {
      values = { ...(newValues ?? defaultValues) }
      errors = {}
      touched = {}
      isDirty = false
      isSubmitting = false
      cachedFieldSnapshots.clear()
      invalidateSnapshot()
      notifyGlobal()
      for (const key of Object.keys(defaultValues as Record<string, unknown>)) {
        notifyField(key as keyof TInput)
      }
    },

    setSubmitting(submitting: boolean) {
      isSubmitting = submitting
      invalidateSnapshot()
      notifyGlobal()
    },

    subscribe(callback: () => void): () => void {
      globalSubscribers.add(callback)
      return () => { globalSubscribers.delete(callback) }
    },

    subscribeField(name: keyof TInput, callback: () => void): () => void {
      let subs = fieldSubscribers.get(name)
      if (!subs) {
        subs = new Set()
        fieldSubscribers.set(name, subs)
      }
      subs.add(callback)
      return () => { subs.delete(callback) }
    },

    // pure: レンダリング中に安全に呼べる
    getSnapshot(): FormState<TInput> {
      if (!cachedSnapshot) {
        cachedSnapshot = {
          values: { ...values },
          errors: { ...errors },
          touched: { ...touched } as { [K in keyof TInput]?: boolean },
          isDirty,
          isSubmitting,
        }
      }
      return cachedSnapshot
    },

    getFieldSnapshot<K extends keyof TInput>(name: K) {
      let cached = cachedFieldSnapshots.get(name)
      if (!cached) {
        cached = {
          value: values[name],
          error: errors[name],
          touched: touched[name as string] ?? false,
        }
        cachedFieldSnapshots.set(name, cached)
      }
      return cached as { value: TInput[K]; error: string | undefined; touched: boolean }
    },
  }

  return store
}
