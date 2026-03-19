import { Component, createContext, useCallback, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { matchRoute } from "./match";

type LayoutComponent = ComponentType<{ children: ReactNode }>;

interface Route {
  path: string;
  component: ComponentType;
  layouts: LayoutComponent[];
  loader?: (args: { params: Record<string, string> }) => Promise<unknown>;
  action?: (args: { params: Record<string, string>; formData: FormData }) => Promise<unknown>;
  Loading?: ComponentType;
  ErrorBoundary?: ComponentType<{ error: Error }>;
}

interface RouterContextValue {
  currentPath: string;
  params: Record<string, string>;
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
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
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
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === currentPath) return;
    clearRouteState();
    window.history.pushState(null, "", to);
    setCurrentPath(to);
  }, [currentPath]);

  const matched = findMatchedRoute(routes, currentPath);
  // #6: params を useMemo で安定化
  const params = useMemo(() => matched?.params ?? {}, [currentPath]);

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

    matched.route.loader({ params }).then(
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
  }, [currentPath, loaderKey]);

  // #2, #3: submitAction を useCallback で安定化 + loaderKey で再実行（キャンセルガード付き）
  const submitAction = useCallback(async (formData: FormData) => {
    if (!matched?.route.action) {
      throw new Error("この route に action が定義されていません");
    }
    const result = await matched.route.action({ params, formData });
    setActionData(result);
    // loader の再実行は effect に委譲（キャンセルガードが効く）
    setLoaderKey((k) => k + 1);
  }, [matched, params]);

  const ctx = useMemo<RouterContextValue>(
    () => ({ currentPath, params, navigate, loaderData, actionData, submitAction }),
    [currentPath, params, navigate, loaderData, actionData, submitAction],
  );

  if (!matched) {
    return <div>No routes found. Add a page.tsx to src/routes/</div>;
  }

  // エラー状態 → ErrorBoundary を探して表示
  if (loaderError) {
    const ErrorComp = findErrorBoundary(matched.route);
    if (ErrorComp) {
      return (
        <RouterContext.Provider value={ctx}>
          <ErrorComp error={loaderError} />
        </RouterContext.Provider>
      );
    }
    throw loaderError;
  }

  // ローディング状態 → Loading コンポーネント or 白画面
  if (isLoading) {
    const LoadingComp = matched.route.Loading;
    return (
      <RouterContext.Provider value={ctx}>
        {LoadingComp ? <LoadingComp /> : null}
      </RouterContext.Provider>
    );
  }

  // layouts を外側から内側にネストして描画
  const Page = matched.route.component;
  let content: ReactNode = <Page />;

  for (let i = matched.route.layouts.length - 1; i >= 0; i--) {
    const Layout = matched.route.layouts[i];
    content = <Layout>{content}</Layout>;
  }

  // #4: key={currentPath} でルート変更時に ErrorBoundary をリセット
  const RenderErrorComp = findErrorBoundary(matched.route);
  if (RenderErrorComp) {
    content = <RouteErrorBoundary key={currentPath} fallback={RenderErrorComp}>{content}</RouteErrorBoundary>;
  }

  return (
    <RouterContext.Provider value={ctx}>
      {content}
    </RouterContext.Provider>
  );
}

/**
 * マッチしたルートの ErrorBoundary を探す。
 */
function findErrorBoundary(route: Route): ComponentType<{ error: Error }> | undefined {
  return route.ErrorBoundary;
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
