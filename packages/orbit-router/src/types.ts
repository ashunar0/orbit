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

/** loader の引数型 */
export type LoaderArgs = {
  params: Record<string, string>;
  search: Record<string, string>;
  /** キャンセル用 AbortSignal — fetch に渡すとナビゲーション中断時にリクエストもキャンセルされる */
  signal: AbortSignal;
};

/** action の引数型。TData で data のスキーマを指定できる */
export type ActionArgs<TData = unknown> = {
  params: Record<string, string>;
  search: Record<string, string>;
  data: TData;
  formData?: FormData;
};
