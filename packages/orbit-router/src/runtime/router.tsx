import {
  Component,
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import { matchRoute } from "./match";
import { isRedirectError } from "./redirect";
import type { GuardArgs } from "../types";

type LayoutComponent = ComponentType<{ children: ReactNode }>;

type GuardFunction = (args: GuardArgs) => Promise<void>;

interface LayoutEntry {
  component: LayoutComponent;
  ErrorBoundary?: ComponentType<{ error: Error }>;
}

interface Route {
  path: string;
  component: ComponentType | LazyExoticComponent<ComponentType>;
  layouts: LayoutEntry[];
  guards: GuardFunction[];
  Loading?: ComponentType;
  ErrorBoundary?: ComponentType<{ error: Error }>;
}

export type NavigationState = "idle" | "loading";

export interface RouterStateContextValue {
  currentPath: string;
  params: Record<string, string>;
  search: Record<string, string>;
  navigationState: NavigationState;
}

/** search params の値として受け付ける型。null/undefined はそのキーを削除する */
export type SearchParamValue = string | number | boolean | null | undefined;

export interface RouterDispatchContextValue {
  navigate: (to: string | number, options?: { replace?: boolean }) => void;
  setSearchParams: (
    params: Record<string, SearchParamValue>,
    options?: { replace?: boolean },
  ) => void;
}

const RouterStateContext = createContext<RouterStateContextValue | null>(null);
const RouterDispatchContext = createContext<RouterDispatchContextValue | null>(null);

export function useRouterStateContext(): RouterStateContextValue {
  const ctx = useContext(RouterStateContext);
  if (!ctx) {
    throw new Error("<Router> の外で useRouterStateContext() は使えません");
  }
  return ctx;
}

export function useRouterDispatchContext(): RouterDispatchContextValue {
  const ctx = useContext(RouterDispatchContext);
  if (!ctx) {
    throw new Error("<Router> の外で useRouterDispatchContext() は使えません");
  }
  return ctx;
}

interface RouterProps {
  routes: Route[];
  NotFound?: ComponentType;
  ErrorFallback?: ComponentType<{ error: Error }>;
  /** SSR 時にサーバーから URL を渡す。省略時は window.location を使用。 */
  url?: string;
}

export function Router({ routes, NotFound, ErrorFallback, url }: RouterProps) {
  const isSSR = url !== undefined;
  const [committedUrl, setCommittedUrl] = useState(() => {
    if (url !== undefined) return url;
    if (typeof window === "undefined") {
      throw new Error("<Router> requires `url` prop in SSR environments");
    }
    return window.location.pathname + window.location.search;
  });
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const [initialGuardDone, setInitialGuardDone] = useState(false);
  const [guardError, setGuardError] = useState<{ error: Error } | null>(null);
  const [navigationState, setNavigationState] = useState<NavigationState>("idle");

  const committedUrlRef = useRef(committedUrl);
  committedUrlRef.current = committedUrl;

  const committedPath = useMemo(() => committedUrl.split("?")[0], [committedUrl]);
  const committedMatched = findMatchedRoute(routes, committedPath);
  const committedParams = useMemo(() => committedMatched?.params ?? {}, [committedMatched]);
  const committedSearch = useMemo(() => parseSearchParams(committedUrl), [committedUrl]);

  // --- ヘルパー関数 ---

  const commitRoute = (url: string) => {
    setPendingUrl(null);
    pendingUrlRef.current = null;
    setCommittedUrl(url);
    setGuardError(null);
    setNavigationState("idle");
  };

  // ナビゲーション開始: guard あり → pending、なし → 即コミット
  const startNavigation = useCallback(
    (to: string) => {
      const toPath = to.split("?")[0];
      const toMatched = findMatchedRoute(routes, toPath);
      const hasGuards = toMatched && toMatched.route.guards.length > 0;

      if (hasGuards) {
        setPendingUrl(to);
        pendingUrlRef.current = to;
        setNavigationState("loading");
      } else {
        commitRoute(to);
      }
    },
    [routes],
  );

  // popstate 対応（SSR 時はスキップ）
  useEffect(() => {
    if (isSSR) return;
    const onPopState = () => {
      const currentUrl = window.location.pathname + window.location.search;
      startNavigation(currentUrl);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [startNavigation, isSSR]);

  const navigate = useCallback(
    (to: string | number, options?: { replace?: boolean }) => {
      if (isSSR) return; // SSR 時はナビゲーション不可
      if (typeof to === "number") {
        window.history.go(to);
        return;
      }
      if (to === committedUrlRef.current && !pendingUrlRef.current) return;
      if (options?.replace) {
        window.history.replaceState(null, "", to);
      } else {
        window.history.pushState(null, "", to);
      }
      startNavigation(to);
    },
    [startNavigation, isSSR],
  );

  const setSearchParams = useCallback(
    (params: Record<string, SearchParamValue>, options?: { replace?: boolean }) => {
      const currentUrl = committedUrlRef.current;
      const currentPath = currentUrl.split("?")[0];
      const currentSearch = parseSearchParams(currentUrl);
      const merged = { ...currentSearch };
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
    },
    [navigate],
  );

  // pending ルートの guard 実行（SSR 時はスキップ）
  useEffect(() => {
    if (isSSR) return;
    if (!pendingUrl) return;

    const pendingPath = pendingUrl.split("?")[0];
    const pendingMatched = findMatchedRoute(routes, pendingPath);

    if (!pendingMatched) {
      commitRoute(pendingUrl);
      return;
    }

    const controller = new AbortController();
    const pendingParams = pendingMatched.params;
    const pendingSearch = parseSearchParams(pendingUrl);
    const targetUrl = pendingUrl;
    const args = { params: pendingParams, search: pendingSearch, signal: controller.signal };

    (async () => {
      for (const guard of pendingMatched.route.guards) {
        if (controller.signal.aborted) return;
        await guard(args);
      }
      if (controller.signal.aborted) return;
      const currentBrowserUrl = window.location.pathname + window.location.search;
      if (currentBrowserUrl !== targetUrl) return;
      commitRoute(targetUrl);
    })().catch((err) => {
      if (controller.signal.aborted) return;
      if (isRedirectError(err)) {
        setPendingUrl(null);
        pendingUrlRef.current = null;
        setNavigationState("idle");
        navigate(err.to, { replace: err.replace });
        return;
      }
      const currentBrowserUrl = window.location.pathname + window.location.search;
      if (currentBrowserUrl !== targetUrl) return;
      setCommittedUrl(targetUrl);
      setPendingUrl(null);
      pendingUrlRef.current = null;
      const error = err instanceof Error ? err : new Error(String(err));
      setGuardError({ error });
      setNavigationState("idle");
    });

    return () => {
      controller.abort();
    };
  }, [pendingUrl]);

  // 初回 guard 実行（ページロード時）
  useEffect(() => {
    if (!committedMatched) {
      setInitialGuardDone(true);
      return;
    }
    const hasGuards = committedMatched.route.guards.length > 0;
    if (!hasGuards) {
      setInitialGuardDone(true);
      return;
    }

    const controller = new AbortController();
    setNavigationState("loading");
    const args = { params: committedParams, search: committedSearch, signal: controller.signal };

    (async () => {
      for (const guard of committedMatched.route.guards) {
        if (controller.signal.aborted) return;
        await guard(args);
      }
      if (!controller.signal.aborted) {
        setInitialGuardDone(true);
        setNavigationState("idle");
      }
    })().catch((err) => {
      if (controller.signal.aborted) return;
      if (isRedirectError(err)) {
        setNavigationState("idle");
        navigate(err.to, { replace: err.replace });
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      setGuardError({ error });
      setInitialGuardDone(true);
      setNavigationState("idle");
    });

    return () => {
      controller.abort();
    };
  }, []);

  const stateCtx = useMemo<RouterStateContextValue>(
    () => ({
      currentPath: committedPath,
      params: committedParams,
      search: committedSearch,
      navigationState,
    }),
    [committedPath, committedParams, committedSearch, navigationState],
  );

  const dispatchCtx = useMemo<RouterDispatchContextValue>(
    () => ({ navigate, setSearchParams }),
    [navigate, setSearchParams],
  );

  // ページコンテンツを決定
  let content: ReactNode;

  if (!committedMatched) {
    content = NotFound ? <NotFound /> : <div>404 — Not Found</div>;
  } else if (guardError) {
    // guard エラー: 最も近い ErrorBoundary を探す
    const ErrorComp = findNearestErrorBoundary(committedMatched.route);
    if (ErrorComp) {
      content = <ErrorComp error={guardError.error} />;
    } else if (ErrorFallback) {
      content = <ErrorFallback error={guardError.error} />;
    } else {
      throw guardError.error;
    }
  } else if (!initialGuardDone && committedMatched.route.guards.length > 0) {
    // 初回 guard 実行中
    const LoadingComp = committedMatched.route.Loading;
    content = LoadingComp ? <LoadingComp /> : null;
  } else {
    const Page = committedMatched.route.component;
    const LoadingFallback = committedMatched.route.Loading;
    content = (
      <Suspense fallback={LoadingFallback ? <LoadingFallback /> : null}>
        <Page />
      </Suspense>
    );

    // page レベルの ErrorBoundary（render エラーキャッチ用）
    if (committedMatched.route.ErrorBoundary) {
      content = (
        <RouteErrorBoundary key={committedPath} fallback={committedMatched.route.ErrorBoundary}>
          {content}
        </RouteErrorBoundary>
      );
    }
  }

  // layouts を外側から内側にネストして描画
  if (committedMatched && !guardError) {
    for (let i = committedMatched.route.layouts.length - 1; i >= 0; i--) {
      const layout = committedMatched.route.layouts[i];
      const Layout = layout.component;
      if (layout.ErrorBoundary) {
        content = (
          <RouteErrorBoundary key={`${committedPath}-layout-${i}`} fallback={layout.ErrorBoundary}>
            {content}
          </RouteErrorBoundary>
        );
      }
      content = <Layout>{content}</Layout>;
    }
  }

  // Router レベルの ErrorFallback
  if (ErrorFallback) {
    content = (
      <RouteErrorBoundary key="router-fallback" fallback={ErrorFallback}>
        {content}
      </RouteErrorBoundary>
    );
  }

  return (
    <RouterStateContext.Provider value={stateCtx}>
      <RouterDispatchContext.Provider value={dispatchCtx}>{content}</RouterDispatchContext.Provider>
    </RouterStateContext.Provider>
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

/**
 * guard エラー時に最も近い ErrorBoundary を探す。
 * page EB → 内側 layout → 外側 layout の順で探索。
 */
function findNearestErrorBoundary(route: Route): ComponentType<{ error: Error }> | undefined {
  if (route.ErrorBoundary) return route.ErrorBoundary;
  for (let i = route.layouts.length - 1; i >= 0; i--) {
    if (route.layouts[i].ErrorBoundary) return route.layouts[i].ErrorBoundary;
  }
  return undefined;
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
