import { useRouterStateContext, useRouterDispatchContext, useLoaderDataContext, useLayoutDataContext, type NavigationState } from "./router";
import type { RegisteredRoutePaths, RegisteredRouteParams, ValidHref } from "../types";

/**
 * 現在のルートのパラメータを取得する。
 * ルートパスを型引数に渡すと、そのルートの params が型安全に返る。
 *
 * @example
 * // 型安全（推奨）
 * const { id } = useParams<"/users/:id">()
 *
 * // 従来互換
 * const params = useParams()
 */
export function useParams<T extends RegisteredRoutePaths = never>(): [T] extends [never] ? Record<string, string> : RegisteredRouteParams[T & keyof RegisteredRouteParams] {
  return useRouterStateContext().params as never;
}

/**
 * loader の戻り値を型付きで取得する。
 * layout / page それぞれ自分のセグメントの loader データを返す。
 *
 * @example
 * import type { loader } from './loader'
 * const data = useLoaderData<typeof loader>()
 */
export function useLoaderData<T extends (...args: never[]) => Promise<unknown>>(): Awaited<ReturnType<T>> {
  return useLoaderDataContext() as Awaited<ReturnType<T>>;
}

/**
 * 直近の親 layout の loader データを型付きで取得する。
 * page から親 layout のデータにアクセスしたい場合に使う。
 *
 * @example
 * import type { loader } from '../loader'  // layout の loader
 * const data = useLayoutData<typeof loader>()
 */
export function useLayoutData<T extends (...args: never[]) => Promise<unknown>>(): Awaited<ReturnType<T>> {
  return useLayoutDataContext() as Awaited<ReturnType<T>>;
}

/**
 * action の戻り値を型付きで取得する。
 *
 * @example
 * import type { action } from './action'
 * const data = useActionData<typeof action>()
 */
export function useActionData<T extends (...args: never[]) => Promise<unknown>>(): Awaited<ReturnType<T>> | undefined {
  return useRouterStateContext().actionData as Awaited<ReturnType<T>> | undefined;
}

/**
 * action を実行する関数を取得する。
 * JSON オブジェクトまたは FormData（ファイルアップロード時）を渡せる。
 *
 * @example
 * const submit = useSubmit()
 * submit({ email, password })          // JSON（普段はこれ）
 * submit(new FormData(form))           // FormData（ファイルアップロード時）
 */
export function useSubmit(): (payload: FormData | Record<string, unknown>) => Promise<void> {
  return useRouterDispatchContext().submitAction;
}

/** search params の値として受け付ける型。null/undefined はそのキーを削除する */
type SearchParamValue = string | number | boolean | null | undefined;

/** search params を更新する関数。現在のパラメータにマージし、null/undefined のキーは削除する */
type SetSearchParams = (
  params: Record<string, SearchParamValue>,
  options?: { replace?: boolean },
) => void;

/**
 * URL の search params を取得・更新する。
 * パース関数を渡すとバリデーション + 型変換ができる。
 *
 * @example
 * // パース関数なし — 生の文字列
 * const [search, setSearch] = useSearchParams()
 *
 * // パース関数あり — 型付き（Zod, Valibot, 自前関数など何でも可）
 * const [{ page }, setSearch] = useSearchParams((raw) => ({
 *   page: Number(raw.page ?? 1),
 * }))
 * setSearch({ page: 2 })  // ?page=2 に更新（他のパラメータは維持）
 *
 * // Zod を使う場合
 * const [search, setSearch] = useSearchParams((raw) => searchSchema.parse(raw))
 *
 * // パラメータの削除
 * setSearch({ q: null })  // ?q を削除
 */
export function useSearchParams(): [Record<string, string>, SetSearchParams];
export function useSearchParams<T>(parse: (raw: Record<string, string>) => T): [T, SetSearchParams];
export function useSearchParams<T>(parse?: (raw: Record<string, string>) => T): [Record<string, string> | T, SetSearchParams] {
  const { search, currentPath } = useRouterStateContext();
  const { navigate } = useRouterDispatchContext();

  const parsed = parse ? parse(search) : search;

  const setSearchParams: SetSearchParams = (params, options) => {
    const merged = { ...search };
    for (const [key, value] of Object.entries(params)) {
      if (value == null) {
        delete merged[key];
      } else {
        merged[key] = String(value);
      }
    }
    const qs = new URLSearchParams(merged).toString();
    const url = qs ? `${currentPath}?${qs}` : currentPath;
    navigate(url, options);
  };

  return [parsed, setSearchParams];
}

/**
 * ナビゲーションの状態を取得する。
 *
 * @example
 * const { state } = useNavigation()
 * // state: "idle" | "loading" | "submitting"
 */
export function useNavigation(): { state: NavigationState } {
  const { navigationState } = useRouterStateContext();
  return { state: navigationState };
}

/**
 * プログラム的にナビゲーションする関数を取得する。
 *
 * @example
 * const navigate = useNavigate()
 * navigate("/users/1")
 * navigate("/login", { replace: true })
 * navigate(-1) // history.back() と同等
 */
export function useNavigate(): (to: ValidHref | number, options?: { replace?: boolean }) => void {
  return useRouterDispatchContext().navigate;
}
