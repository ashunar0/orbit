import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { ZodType, ZodTypeDef } from "zod";
import { createFormStore } from "./store";
import type { DependencyCallback, FormStore } from "./types";

/** Zod スキーマから input 型を抽出 */
type InferInput<T extends ZodType> = T["_input"];
/** Zod スキーマから output 型を抽出 */
type InferOutput<T extends ZodType> = T["_output"];

export interface UseFormOptions<TSchema extends ZodType<any, ZodTypeDef, any>> {
  schema: TSchema;
  defaultValues: InferInput<TSchema> | undefined;
  dependencies?: { [K in keyof InferInput<TSchema>]?: DependencyCallback<InferInput<TSchema>, K> };
}

export interface RegisterProps<T> {
  value: T;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  onBlur: () => void;
}

export interface UseFormReturn<TInput extends Record<string, unknown>, TOutput> {
  /** defaultValues が undefined の間は null（非同期データ待ち） */
  store: FormStore<TInput, TOutput> | null;
  values: TInput;
  errors: { [K in keyof TInput]?: string } & { _root?: string };
  isDirty: boolean;
  isSubmitting: boolean;
  submit: (onSubmit: (data: TOutput) => void | Promise<unknown>) => (e?: React.FormEvent) => void;
  reset: (name?: keyof TInput) => void;
  /** フィールドを HTML input にバインドする props を返す */
  register: <K extends keyof TInput & string>(name: K) => RegisterProps<TInput[K]>;
  /** プログラム的にフィールドの値を設定する（Select, DatePicker 等の非 input コンポーネント向け） */
  setValue: <K extends keyof TInput & string>(name: K, value: TInput[K]) => void;
  /** フィールドのエラーメッセージを返す */
  fieldError: <K extends keyof TInput>(name: K) => string | undefined;
}

export function useForm<TSchema extends ZodType<any, ZodTypeDef, any>>(
  options: UseFormOptions<TSchema>,
): UseFormReturn<InferInput<TSchema>, InferOutput<TSchema>> {
  type TInput = InferInput<TSchema>;
  type TOutput = InferOutput<TSchema>;
  const { schema, defaultValues, dependencies } = options;

  // defaultValues が undefined の間は空のストアを使わない
  // → orbit-query からの非同期データ到着を待つ
  const hasValues = defaultValues !== undefined;

  // store は defaultValues が確定したら1回だけ作る
  // defaultValues が変わったら resetAll で反映（store は再作成しない）
  const storeRef = useRef<FormStore<TInput, TOutput> | null>(null);

  if (hasValues && !storeRef.current) {
    storeRef.current = createFormStore({ schema, defaultValues, dependencies });
  }

  // defaultValues が変わったら resetAll で反映する
  // - undefined → 値: 非同期データ到着（初回）
  // - 値A → 値B: 同じコンポーネントが別データで再利用（例: /issues/1 → /issues/2）
  // インラインオブジェクトで毎レンダリング新参照になっても shallow equal でスキップ
  const prevDefaultsRef = useRef(defaultValues);
  useEffect(() => {
    if (defaultValues === undefined) return;
    if (shallowEqual(prevDefaultsRef.current, defaultValues)) return;
    prevDefaultsRef.current = defaultValues;

    if (storeRef.current) {
      storeRef.current.resetAll(defaultValues);
    } else {
      storeRef.current = createFormStore({ schema, defaultValues, dependencies });
    }
  }, [defaultValues, schema, dependencies]);

  const store = storeRef.current;

  // useSyncExternalStore でフォーム全体を購読
  const snapshot = useSyncExternalStore(
    (cb) => store?.subscribe(cb) ?? (() => {}),
    () =>
      store?.getSnapshot() ?? (EMPTY_STATE as ReturnType<NonNullable<typeof store>["getSnapshot"]>),
  );

  // submit: onSubmit をクロージャでキャプチャ（レンダリング中の副作用なし）
  const submit = useMemo(() => {
    return (onSubmit: (data: TOutput) => void | Promise<unknown>) => {
      return (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!store) return;

        const data = store.validate();
        if (data === null) return;

        store.setSubmitting(true);
        const result = onSubmit(data);
        if (result instanceof Promise) {
          void result.finally(() => store.setSubmitting(false));
        } else {
          store.setSubmitting(false);
        }
      };
    };
  }, [store]);

  const reset = useMemo(() => {
    return (name?: keyof TInput) => {
      store?.reset(name);
    };
  }, [store]);

  // register: フィールドを HTML input にバインドする props を返す
  // snapshot から読むだけ — useSyncExternalStore で購読済みなので再レンダリング時に最新値が返る
  function register<K extends keyof TInput & string>(name: K): RegisterProps<TInput[K]> {
    return {
      value: snapshot.values[name],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
      ) => {
        store?.setValue(name, e.target.value as TInput[K]);
      },
      onBlur: () => {
        store?.setTouched(name);
        store?.validateField(name);
      },
    };
  }

  function setValue<K extends keyof TInput & string>(name: K, value: TInput[K]) {
    store?.setValue(name, value);
  }

  function fieldError<K extends keyof TInput>(name: K): string | undefined {
    return snapshot.errors[name];
  }

  return {
    store,
    values: snapshot.values,
    errors: snapshot.errors,
    isDirty: snapshot.isDirty,
    isSubmitting: snapshot.isSubmitting,
    submit,
    reset,
    register,
    setValue,
    fieldError,
  };
}

const EMPTY_STATE = {
  values: {} as Record<string, unknown>,
  errors: {},
  touched: {},
  isDirty: false,
  isSubmitting: false,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}
