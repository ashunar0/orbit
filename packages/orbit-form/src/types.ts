import type { ZodType, ZodTypeDef } from "zod"

export type FieldErrors<T> = {
  [K in keyof T]?: string
} & {
  _root?: string
}

export interface FormState<T> {
  values: T
  errors: FieldErrors<T>
  touched: { [K in keyof T]?: boolean }
  isDirty: boolean
  isSubmitting: boolean
}

export type DependencyCallback<T> = (
  value: unknown,
  form: { reset: (name: keyof T) => void; setValue: (name: keyof T, value: unknown) => void },
) => void

export interface FormStoreOptions<TInput, TOutput> {
  schema: ZodType<TOutput, ZodTypeDef, TInput>
  defaultValues: TInput
  dependencies?: { [K in keyof TInput]?: DependencyCallback<TInput> }
}

export interface FormStore<TInput, TOutput> {
  getState(): FormState<TInput>
  getFieldValue<K extends keyof TInput>(name: K): TInput[K]
  getFieldError<K extends keyof TInput>(name: K): string | undefined
  getFieldTouched<K extends keyof TInput>(name: K): boolean
  setValue<K extends keyof TInput>(name: K, value: TInput[K]): void
  setTouched<K extends keyof TInput>(name: K, touched?: boolean): void
  validate(): TOutput | null
  validateField<K extends keyof TInput>(name: K): void
  reset(name?: keyof TInput): void
  resetAll(values?: TInput): void
  setSubmitting(submitting: boolean): void
  subscribe(callback: () => void): () => void
  subscribeField(name: keyof TInput, callback: () => void): () => void
  getSnapshot(): FormState<TInput>
  getFieldSnapshot<K extends keyof TInput>(name: K): { value: TInput[K]; error: string | undefined; touched: boolean }
}
