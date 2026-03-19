import type { ZodType } from "zod";
import { useRouterContext, type NavigationState } from "./router";

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

/**
 * URL の search params を取得する。
 * Zod スキーマを渡すとバリデーション + 型推論が効く。
 *
 * @example
 * // スキーマなし — 生の文字列
 * const search = useSearchParams()  // Record<string, string>
 *
 * // スキーマあり — 型付き
 * import { searchSchema } from './loader'
 * const { page, sort } = useSearchParams(searchSchema)  // { page: number, sort: string }
 */
export function useSearchParams(): Record<string, string>;
export function useSearchParams<T extends ZodType>(schema: T): T["_output"];
export function useSearchParams(schema?: ZodType): unknown {
  const raw = useRouterContext().search;
  if (!schema) return raw;
  return schema.parse(raw);
}

/**
 * ナビゲーションの状態を取得する。
 *
 * @example
 * const { state } = useNavigation()
 * // state: "idle" | "loading" | "submitting"
 */
export function useNavigation(): { state: NavigationState } {
  const { navigationState } = useRouterContext();
  return { state: navigationState };
}

/**
 * プログラム的にナビゲーションする関数を取得する。
 *
 * @example
 * const navigate = useNavigate()
 * navigate("/users/1")
 */
export function useNavigate(): (to: string) => void {
  return useRouterContext().navigate;
}
