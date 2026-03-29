/**
 * guard 内でリダイレクトする。
 * 内部で throw するので、呼び出し側は `redirect("/")` だけで OK。
 *
 * @example
 * export async function guard() {
 *   if (!isAuthenticated()) redirect("/login");
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
  if (!to.startsWith("/") || to.startsWith("//")) {
    throw new Error(
      `redirect() only accepts internal paths (must start with "/" and not "//"). Received: ${to}`,
    );
  }
  throw new RedirectError(to, options);
}

export function isRedirectError(error: unknown): error is RedirectError {
  return error instanceof RedirectError;
}
