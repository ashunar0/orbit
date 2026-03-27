import { createContext, use, type ReactNode } from "react"
import { useField } from "./use-field"
import type { FormStore } from "./types"

// --- FormContext ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FormStoreContext = createContext<FormStore<any, any> | null>(null)

export function useFormStore<TInput extends Record<string, unknown>, TOutput>(): FormStore<TInput, TOutput> {
  const store = use(FormStoreContext)
  if (!store) {
    throw new Error("useFormStore must be used within a <Form>")
  }
  return store as FormStore<TInput, TOutput>
}

// --- Form ---

export interface FormProps<TInput extends Record<string, unknown>, TOutput> {
  form: { store: FormStore<TInput, TOutput> | null; submit: (onSubmit: (data: TOutput) => void | Promise<void>) => (e?: React.FormEvent) => void }
  onSubmit: (data: TOutput) => void | Promise<void>
  children: ReactNode
}

export function Form<TInput extends Record<string, unknown>, TOutput>(
  props: FormProps<TInput, TOutput>,
) {
  const { form, onSubmit, children } = props

  if (!form.store) return null

  return (
    <FormStoreContext value={form.store}>
      <form onSubmit={form.submit(onSubmit)}>
        {children}
      </form>
    </FormStoreContext>
  )
}

// --- Field ---

export interface FieldProps<TInput extends Record<string, unknown>, TOutput, K extends keyof TInput & string> {
  name: K
  /** store prop は省略可能。省略時は親の <Form> から自動取得 */
  store?: FormStore<TInput, TOutput>
  children: (field: ReturnType<typeof useField<TInput, TOutput, K>>) => ReactNode
}

export function Field<TInput extends Record<string, unknown>, TOutput, K extends keyof TInput & string>(
  props: FieldProps<TInput, TOutput, K>,
) {
  const contextStore = use(FormStoreContext)
  const store = (props.store ?? contextStore) as FormStore<TInput, TOutput>
  if (!store) {
    throw new Error("<Field> must be used within a <Form> or receive a store prop")
  }
  const field = useField(store, props.name)
  return <>{props.children(field)}</>
}
