import type { ReactNode } from "react"
import { useField } from "./use-field"
import type { FormStore } from "./types"

// --- Form ---

export interface FormProps<TInput extends Record<string, unknown>, TOutput> {
  form: { store: FormStore<TInput, TOutput>; submit: (onSubmit: (data: TOutput) => void | Promise<void>) => (e?: React.FormEvent) => void }
  onSubmit: (data: TOutput) => void | Promise<void>
  children: ReactNode
}

export function Form<TInput extends Record<string, unknown>, TOutput>(
  props: FormProps<TInput, TOutput>,
) {
  const { form, onSubmit, children } = props

  return (
    <form onSubmit={form.submit(onSubmit)}>
      {children}
    </form>
  )
}

// --- Field ---

export interface FieldProps<TInput extends Record<string, unknown>, TOutput, K extends keyof TInput & string> {
  store: FormStore<TInput, TOutput>
  name: K
  children: (field: ReturnType<typeof useField<TInput, TOutput, K>>) => ReactNode
}

export function Field<TInput extends Record<string, unknown>, TOutput, K extends keyof TInput & string>(
  props: FieldProps<TInput, TOutput, K>,
) {
  const field = useField(props.store, props.name)
  return <>{props.children(field)}</>
}
