import { Component, createContext, useCallback, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { matchRoute } from "./match";

type LayoutComponent = ComponentType<{ children: ReactNode }>;

interface Route {
  path: string;
  component: ComponentType;
  layouts: LayoutComponent[];
  loader?: (args: { params: Record<string, string>; search: Record<string, string> }) => Promise<unknown>;
  action?: (args: { params: Record<string, string>; search: Record<string, string>; formData: FormData }) => Promise<unknown>;
  Loading?: ComponentType;
  ErrorBoundary?: ComponentType<{ error: Error }>;
}

interface RouterContextValue {
  currentPath: string;
  params: Record<string, string>;
  search: Record<string, string>;
  navigate: (to: string) => void;
  loaderData: unknown;
  actionData: unknown;
  submitAction: (formData: FormData) => Promise<void>;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function useRouterContext(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error("<Router> の外で useRouterContext() は使えません");
  }
  return ctx;
}

interface RouterProps {
  routes: Route[];
}

export function Router({ routes }: RouterProps) {
  const [currentUrl, setCurrentUrl] = useState(() => window.location.pathname + window.location.search);
  const currentPath = useMemo(() => currentUrl.split("?")[0], [currentUrl]);
  const [loaderData, setLoaderData] = useState<unknown>(undefined);
  const [actionData, setActionData] = useState<unknown>(undefined);
  const [loaderError, setLoaderError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // action 後に loader を再実行するためのキー
  const [loaderKey, setLoaderKey] = useState(0);

  // ナビゲーション時にステートを即座にクリア（#1, #5: stale data / error flash 防止）
  const clearRouteState = () => {
    setLoaderData(undefined);
    setActionData(undefined);
    setLoaderError(null);
  };

  useEffect(() => {
    const onPopState = () => {
      clearRouteState();
      setCurrentUrl(window.location.pathname + window.location.search);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === currentUrl) return;
    clearRouteState();
    window.history.pushState(null, "", to);
    setCurrentUrl(to);
  }, [currentUrl]);

  const matched = findMatchedRoute(routes, currentPath);
  const params = useMemo(() => matched?.params ?? {}, [currentPath]);
  const search = useMemo(() => parseSearchParams(currentUrl), [currentUrl]);

  // loader 呼び出し
  useEffect(() => {
    if (!matched?.route.loader) {
      setLoaderData(undefined);
      setLoaderError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoaderError(null);

    matched.route.loader({ params, search }).then(
      (data) => {
        if (!cancelled) {
          setLoaderData(data);
          setIsLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          setLoaderError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      },
    );

    return () => { cancelled = true; };
  }, [currentUrl, loaderKey]);

  const submitAction = useCallback(async (formData: FormData) => {
    const action = matched?.route.action;
    if (!action) {
      throw new Error("この route に action が定義されていません");
    }
    const currentRoute = matched.route;
    const result = await action({ params, search, formData });
    // ナビゲーション済みなら state を更新しない
    if (matched?.route === currentRoute) {
      setActionData(result);
      setLoaderKey((k) => k + 1);
    }
  }, [matched, params]);

  const ctx = useMemo<RouterContextValue>(
    () => ({ currentPath, params, search, navigate, loaderData, actionData, submitAction }),
    [currentPath, params, search, navigate, loaderData, actionData, submitAction],
  );

  if (!matched) {
    return <div>No routes found. Add a page.tsx to src/routes/</div>;
  }

  // ページコンテンツを決定（エラー → ローディング → 通常の優先度）
  let content: ReactNode;

  if (loaderError) {
    const ErrorComp = matched.route.ErrorBoundary;
    if (ErrorComp) {
      content = <ErrorComp error={loaderError} />;
    } else {
      throw loaderError;
    }
  } else if (isLoading || (matched.route.loader && loaderData === undefined)) {
    const LoadingComp = matched.route.Loading;
    content = LoadingComp ? <LoadingComp /> : null;
  } else {
    const Page = matched.route.component;
    content = <Page />;

    // レンダーエラー用の ErrorBoundary でラップ（key でルート変更時にリセット）
    if (matched.route.ErrorBoundary) {
      content = <RouteErrorBoundary key={currentPath} fallback={matched.route.ErrorBoundary}>{content}</RouteErrorBoundary>;
    }
  }

  // layouts を外側から内側にネストして描画（エラー・ローディング時も layout は残る）
  for (let i = matched.route.layouts.length - 1; i >= 0; i--) {
    const Layout = matched.route.layouts[i];
    content = <Layout>{content}</Layout>;
  }

  return (
    <RouterContext.Provider value={ctx}>
      {content}
    </RouterContext.Provider>
  );
}

/**
 * React ErrorBoundary（class component）— レンダー中のエラーをキャッチする。
 */
interface RouteErrorBoundaryProps {
  fallback: ComponentType<{ error: Error }>;
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      const Fallback = this.props.fallback;
      return <Fallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

function parseSearchParams(url: string): Record<string, string> {
  const idx = url.indexOf("?");
  if (idx === -1) return {};
  const result: Record<string, string> = {};
  new URLSearchParams(url.slice(idx)).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function findMatchedRoute(
  routes: Route[],
  currentPath: string,
): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    const result = matchRoute(route.path, currentPath);
    if (result) return { route, params: result.params };
  }
  return null;
}
