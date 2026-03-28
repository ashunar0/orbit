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

export interface FormProps<TInput extends Record<string, unknown>, TOutput>
  extends Omit<React.ComponentProps<"form">, "onSubmit" | "children"> {
  form: { store: FormStore<TInput, TOutput> | null; submit: (onSubmit: (data: TOutput) => void | Promise<unknown>) => (e?: React.FormEvent) => void }
  onSubmit: (data: TOutput) => void | Promise<unknown>
  children: ReactNode
}

export function Form<TInput extends Record<string, unknown>, TOutput>(
  props: FormProps<TInput, TOutput>,
) {
  const { form, onSubmit, children, ...rest } = props

  if (!form.store) return null

  return (
    <FormStoreContext value={form.store}>
      <form onSubmit={form.submit(onSubmit)} {...rest}>
        {children}
      </form>
    </FormStoreContext>
  )
}

// --- Field ---

export interface FieldProps<TInput extends Record<string, unknown>, TOutput, K extends keyof TInput & string> {
  name: K
  /** form prop を渡すと型推論が効く（推奨） */
  form?: { store: FormStore<TInput, TOutput> | null }
  /** store を直接渡す場合 */
  store?: FormStore<TInput, TOutput>
  children: (field: ReturnType<typeof useField<TInput, TOutput, K>>) => ReactNode
}

export function Field<TInput extends Record<string, unknown>, TOutput, K extends keyof TInput & string>(
  props: FieldProps<TInput, TOutput, K>,
) {
  const contextStore = use(FormStoreContext)
  const store = (props.store ?? props.form?.store ?? contextStore) as FormStore<TInput, TOutput>
  if (!store) {
    throw new Error("<Field> must be used within a <Form> or receive a form/store prop")
  }
  const field = useField(store, props.name)
  return <>{props.children(field)}</>
}
