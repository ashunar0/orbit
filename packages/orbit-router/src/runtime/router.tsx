import { Component, Suspense, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { matchRoute } from "./match";

type LayoutComponent = ComponentType<{ children: ReactNode }>;

interface Route {
  path: string;
  component: ComponentType | LazyExoticComponent<ComponentType>;
  layouts: LayoutComponent[];
  loader?: (args: { params: Record<string, string>; search: Record<string, string> }) => Promise<unknown>;
  action?: (args: { params: Record<string, string>; search: Record<string, string>; formData: FormData }) => Promise<unknown>;
  Loading?: ComponentType;
  ErrorBoundary?: ComponentType<{ error: Error }>;
}

export type NavigationState = "idle" | "loading" | "submitting";

interface RouterContextValue {
  currentPath: string;
  params: Record<string, string>;
  search: Record<string, string>;
  navigate: (to: string) => void;
  loaderData: unknown;
  actionData: unknown;
  submitAction: (formData: FormData) => Promise<void>;
  navigationState: NavigationState;
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
  // committedUrl = 表示中のルート、pendingUrl = 遷移先（loader 実行中）
  const [committedUrl, setCommittedUrl] = useState(() => window.location.pathname + window.location.search);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const [loaderData, setLoaderData] = useState<unknown>(undefined);
  const [actionData, setActionData] = useState<unknown>(undefined);
  const [loaderError, setLoaderError] = useState<Error | null>(null);
  const [navigationState, setNavigationState] = useState<NavigationState>("idle");
  const [loaderKey, setLoaderKey] = useState(0);

  const committedUrlRef = useRef(committedUrl);
  committedUrlRef.current = committedUrl;

  const committedPath = useMemo(() => committedUrl.split("?")[0], [committedUrl]);
  const committedMatched = findMatchedRoute(routes, committedPath);
  const committedParams = useMemo(() => committedMatched?.params ?? {}, [committedMatched]);
  const committedSearch = useMemo(() => parseSearchParams(committedUrl), [committedUrl]);

  // popstate 対応
  useEffect(() => {
    const onPopState = () => {
      const url = window.location.pathname + window.location.search;
      startNavigation(url);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [routes]);

  // ナビゲーション開始: loader があれば pending、なければ即コミット
  const startNavigation = useCallback((to: string) => {
    const toPath = to.split("?")[0];
    const toMatched = findMatchedRoute(routes, toPath);

    if (toMatched?.route.loader) {
      // loader あり → pending にして裏で実行
      setPendingUrl(to);
      pendingUrlRef.current = to;
      setNavigationState("loading");
    } else {
      // loader なし → 即コミット
      setPendingUrl(null);
      pendingUrlRef.current = null;
      setCommittedUrl(to);
      setLoaderData(undefined);
      setLoaderError(null);
      setActionData(undefined);
      setNavigationState("idle");
    }
  }, [routes]);

  const navigate = useCallback((to: string) => {
    if (to === committedUrlRef.current && !pendingUrlRef.current) return;
    window.history.pushState(null, "", to);
    startNavigation(to);
  }, [startNavigation]);

  // pending ルートの loader 実行
  useEffect(() => {
    if (!pendingUrl) return;

    const pendingPath = pendingUrl.split("?")[0];
    const pendingMatched = findMatchedRoute(routes, pendingPath);

    if (!pendingMatched?.route.loader) {
      // loader がない（popstate 等で来た場合のフォールバック）
      setCommittedUrl(pendingUrl);
      setPendingUrl(null);
      pendingUrlRef.current = null;
      setLoaderData(undefined);
      setLoaderError(null);
      setNavigationState("idle");
      return;
    }

    let cancelled = false;
    const pendingParams = pendingMatched.params;
    const pendingSearch = parseSearchParams(pendingUrl);

    const targetUrl = pendingUrl;
    pendingMatched.route.loader({ params: pendingParams, search: pendingSearch }).then(
      (data) => {
        if (cancelled) return;
        // C-1: popstate で URL が変わっていたらコミットしない
        const currentBrowserUrl = window.location.pathname + window.location.search;
        if (currentBrowserUrl !== targetUrl) return;
        setCommittedUrl(targetUrl);
        setPendingUrl(null);
        pendingUrlRef.current = null;
        setLoaderData(data);
        setLoaderError(null);
        setNavigationState("idle");
      },
      (err) => {
        if (cancelled) return;
        const currentBrowserUrl = window.location.pathname + window.location.search;
        if (currentBrowserUrl !== targetUrl) return;
        setCommittedUrl(targetUrl);
        setPendingUrl(null);
        pendingUrlRef.current = null;
        setLoaderError(err instanceof Error ? err : new Error(String(err)));
        setNavigationState("idle");
      },
    );

    return () => { cancelled = true; };
  }, [pendingUrl]);

  // action 後の loader 再実行（loaderKey でトリガー）
  useEffect(() => {
    if (loaderKey === 0) return; // 初回は実行しない
    if (!committedMatched?.route.loader) return;

    let cancelled = false;
    committedMatched.route.loader({ params: committedParams, search: committedSearch }).then(
      (data) => {
        if (!cancelled) {
          setLoaderData(data);
        }
      },
      (err) => {
        if (!cancelled) {
          setLoaderError(err instanceof Error ? err : new Error(String(err)));
        }
      },
    );

    return () => { cancelled = true; };
  }, [loaderKey]);

  // 初回 loader 実行（ページロード時）
  useEffect(() => {
    if (!committedMatched?.route.loader) return;
    if (loaderData !== undefined) return; // 既にデータがある

    let cancelled = false;
    setNavigationState("loading");

    committedMatched.route.loader({ params: committedParams, search: committedSearch }).then(
      (data) => {
        if (!cancelled) {
          setLoaderData(data);
          setNavigationState("idle");
        }
      },
      (err) => {
        if (!cancelled) {
          setLoaderError(err instanceof Error ? err : new Error(String(err)));
          setNavigationState("idle");
        }
      },
    );

    return () => { cancelled = true; };
  }, []);

  const submitAction = useCallback(async (formData: FormData) => {
    const action = committedMatched?.route.action;
    if (!action) {
      throw new Error("この route に action が定義されていません");
    }
    const urlAtSubmit = committedUrlRef.current;
    setNavigationState("submitting");
    try {
      const result = await action({ params: committedParams, search: committedSearch, formData });
      if (committedUrlRef.current === urlAtSubmit) {
        setActionData(result);
        setNavigationState("idle");
        setLoaderKey((k) => k + 1);
      }
    } catch (err) {
      if (committedUrlRef.current === urlAtSubmit) {
        setNavigationState("idle");
      }
      throw err;
    }
  }, [committedMatched, committedParams, committedSearch]);

  const ctx = useMemo<RouterContextValue>(
    () => ({
      currentPath: committedPath,
      params: committedParams,
      search: committedSearch,
      navigate,
      loaderData,
      actionData,
      submitAction,
      navigationState,
    }),
    [committedPath, committedParams, committedSearch, navigate, loaderData, actionData, submitAction, navigationState],
  );

  if (!committedMatched) {
    return <div>No routes found. Add a page.tsx to src/routes/</div>;
  }

  // ページコンテンツを決定
  let content: ReactNode;

  if (loaderError) {
    const ErrorComp = committedMatched.route.ErrorBoundary;
    if (ErrorComp) {
      content = <ErrorComp error={loaderError} />;
    } else {
      throw loaderError;
    }
  } else if (committedMatched.route.loader && loaderData === undefined) {
    // 初回ロード中（まだ一度も loader が完了していない）
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

    if (committedMatched.route.ErrorBoundary) {
      content = <RouteErrorBoundary key={committedPath} fallback={committedMatched.route.ErrorBoundary}>{content}</RouteErrorBoundary>;
    }
  }

  // layouts を外側から内側にネストして描画
  for (let i = committedMatched.route.layouts.length - 1; i >= 0; i--) {
    const Layout = committedMatched.route.layouts[i];
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
