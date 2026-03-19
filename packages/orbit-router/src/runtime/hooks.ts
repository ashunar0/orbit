import { useRouterContext } from "./router";

export function useParams(): Record<string, string> {
  return useRouterContext().params;
}

/**
 * loader の戻り値を型付きで取得する。
 *
 * @example
 * import type { loader } from './loader'
 * const data = useLoaderData<typeof loader>()
 */
export function useLoaderData<T extends (...args: never[]) => Promise<unknown>>(): Awaited<ReturnType<T>> {
  return useRouterContext().loaderData as Awaited<ReturnType<T>>;
}

/**
 * action の戻り値を型付きで取得する。
 *
 * @example
 * import type { action } from './action'
 * const data = useActionData<typeof action>()
 */
export function useActionData<T extends (...args: never[]) => Promise<unknown>>(): Awaited<ReturnType<T>> | undefined {
  return useRouterContext().actionData as Awaited<ReturnType<T>> | undefined;
}

/**
 * action を実行する関数を取得する。
 *
 * @example
 * const submit = useSubmit()
 * submit(new FormData(form))
 */
export function useSubmit(): (formData: FormData) => Promise<void> {
  return useRouterContext().submitAction;
}
