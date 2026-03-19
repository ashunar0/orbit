export interface MatchResult {
  params: Record<string, string>;
}

/**
 * URL パスがルートパターンにマッチするか判定し、パラメータを抽出する。
 *
 *   matchRoute("/users/:id", "/users/123") → { params: { id: "123" } }
 *   matchRoute("/users/:id", "/about")     → null
 */
export function matchRoute(pattern: string, pathname: string): MatchResult | null {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);

  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternSegments.length; i++) {
    const pat = patternSegments[i];
    const seg = pathSegments[i];

    if (pat.startsWith(":")) {
      params[pat.slice(1)] = decodeURIComponent(seg);
    } else if (pat !== seg) {
      return null;
    }
  }

  return { params };
}
