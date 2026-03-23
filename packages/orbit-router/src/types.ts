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
