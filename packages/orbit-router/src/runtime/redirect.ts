/**
 * guard / loader / action 内でリダイレクトする。
 * 内部で throw するので、呼び出し側は `redirect("/")` だけで OK。
 *
 * @example
 * export async function guard() {
 *   if (!isAuthenticated()) redirect("/login");
 * }
 *
 * export async function action({ data }: ActionArgs<LoginData>) {
 *   await login(data);
 *   redirect("/dashboard");
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

export function redirect(to: string, options?: { replace?: boolean }): never {
  throw new RedirectError(to, options);
}

export function isRedirectError(error: unknown): error is RedirectError {
  return error instanceof RedirectError;
}
