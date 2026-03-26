/**
 * アプリ側で型情報を登録するためのインターフェース。
 * .orbit/route-types.d.ts が declare module "orbit-router" で拡張する。
 */
export interface Register {
  // routePaths: RoutePaths — 自動生成で上書きされる
  // routeParams: RouteParams — 自動生成で上書きされる
}

/** 登録済みのルートパスのユニオン型。未登録なら string にフォールバック */
export type RegisteredRoutePaths = Register extends { routePaths: infer T } ? T : string;

/** 登録済みのルートパラメータマッピング。未登録なら Record<string, string> にフォールバック */
export type RegisteredRouteParams = Register extends { routeParams: infer T } ? T : Record<string, Record<string, string>>;

/**
 * ルートパスのパラメータ部分（:param）を string に置換した型。
 * 例: "/users/:id" → "/users/${string}"
 * 静的ルートはそのまま返す。
 */
type ResolvePathParams<T extends string> =
  T extends `${infer Head}:${string}/${infer Rest}`
    ? `${Head}${string}/${ResolvePathParams<Rest>}`
    : T extends `${infer Head}:${string}`
      ? `${Head}${string}`
      : T;

/** Link / useNavigate で使える href 型。動的パラメータは埋め込み済みの文字列を受け付ける */
export type ValidHref = RegisteredRoutePaths extends string
  ? RegisteredRoutePaths extends never
    ? string
    : ResolvePathParams<RegisteredRoutePaths>
  : string;

/**
 * loader の引数型。
 * ルートパスを型引数に渡すと params が型安全になる。
 *
 * @example
 * // 型安全（推奨）
 * export const loader = async ({ params }: LoaderArgs<"/users/:id">) => {
 *   const user = await getUser(params.id) // id: string
 * }
 *
 * // 従来互換
 * export const loader = async ({ params }: LoaderArgs) => { ... }
 */
export type LoaderArgs<T extends RegisteredRoutePaths = never> = {
  params: [T] extends [never] ? Record<string, string> : RegisteredRouteParams[T & keyof RegisteredRouteParams];
  search: Record<string, string>;
  /** キャンセル用 AbortSignal — fetch に渡すとナビゲーション中断時にリクエストもキャンセルされる */
  signal: AbortSignal;
};

/**
 * action の引数型。
 * TRoute でルートパス、TData で data のスキーマを指定できる。
 *
 * @example
 * export const action = async ({ params, data }: ActionArgs<"/users/:id", FormData>) => { ... }
 */
export type ActionArgs<TRoute extends RegisteredRoutePaths = never, TData = unknown> = {
  params: [TRoute] extends [never] ? Record<string, string> : RegisteredRouteParams[TRoute & keyof RegisteredRouteParams];
  search: Record<string, string>;
  data: TData;
  formData?: FormData;
};
