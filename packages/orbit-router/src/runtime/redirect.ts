/**
 * guard / loader 内で throw して、ページ描画前にリダイレクトする。
 *
 * @example
 * export async function guard() {
 *   if (!isAuthenticated()) throw redirect("/login");
 * }
 */
export class RedirectError {
  readonly to: string;
  readonly replace: boolean;

  constructor(to: string, options?: { replace?: boolean }) {
    this.to = to;
    this.replace = options?.replace ?? false;
  }
}

export function redirect(to: string, options?: { replace?: boolean }): RedirectError {
  return new RedirectError(to, options);
}

export function isRedirectError(error: unknown): error is RedirectError {
  return error instanceof RedirectError;
}
