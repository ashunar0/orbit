import { Component, Suspense, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { matchRoute } from "./match";
import { isRedirectError } from "./redirect";
import type { LoaderArgs, ActionArgs } from "../types";

type LayoutComponent = ComponentType<{ children: ReactNode }>;

type LoaderFunction = (args: LoaderArgs) => Promise<unknown>;

type GuardFunction = (args: LoaderArgs) => Promise<void>;

interface LayoutEntry {
  component: LayoutComponent;
  loader?: LoaderFunction;
}

interface Route {
  path: string;
  component: ComponentType | LazyExoticComponent<ComponentType>;
  layouts: LayoutEntry[];
  guards: GuardFunction[];
  loader?: LoaderFunction;
  action?: (args: ActionArgs) => Promise<unknown>;
  Loading?: ComponentType;
  ErrorBoundary?: ComponentType<{ error: Error }>;
}

export type NavigationState = "idle" | "loading" | "submitting";

export interface RouterStateContextValue {
  currentPath: string;
  params: Record<string, string>;
  search: Record<string, string>;
  actionData: unknown;
  navigationState: NavigationState;
}

export interface RouterDispatchContextValue {
  navigate: (to: string | number, options?: { replace?: boolean }) => void;
  submitAction: (payload: FormData | Record<string, unknown>) => Promise<void>;
  prefetch: (to: string) => void;
}

const RouterStateContext = createContext<RouterStateContextValue | null>(null);
const RouterDispatchContext = createContext<RouterDispatchContextValue | null>(null);
const LoaderDataContext = createContext<unknown>(undefined);

export function useLoaderDataContext(): unknown {
  return useContext(LoaderDataContext);
}

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
}

export function Router({ routes, NotFound }: RouterProps) {
  // committedUrl = 表示中のルート、pendingUrl = 遷移先（loader 実行中）
  const [committedUrl, setCommittedUrl] = useState(() => window.location.pathname + window.location.search);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const [pageLoaderData, setPageLoaderData] = useState<unknown>(undefined);
  const [layoutLoaderDatas, setLayoutLoaderDatas] = useState<unknown[]>([]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [actionData, setActionData] = useState<unknown>(undefined);
  const [loaderError, setLoaderError] = useState<Error | null>(null);
  const [navigationState, setNavigationState] = useState<NavigationState>("idle");
  const [loaderKey, setLoaderKey] = useState(0);
  // 前回コミットした layout を追跡（skip 判定用）
  const committedLayoutsRef = useRef<LayoutEntry[]>([]);
  const layoutLoaderDatasRef = useRef<unknown[]>([]);
  const PREFETCH_TTL = 30_000; // 30秒
  const prefetchCache = useRef(new Map<string, { data: unknown; cachedAt: number }>());
  const prefetchInFlight = useRef(new Set<string>());

  const committedUrlRef = useRef(committedUrl);
  committedUrlRef.current = committedUrl;

  const committedPath = useMemo(() => committedUrl.split("?")[0], [committedUrl]);
  const committedMatched = findMatchedRoute(routes, committedPath);
  const committedParams = useMemo(() => committedMatched?.params ?? {}, [committedMatched]);
  const committedSearch = useMemo(() => parseSearchParams(committedUrl), [committedUrl]);

  // --- ヘルパー関数 ---

  const commitRoute = (url: string, pageLd: unknown, layoutLds: unknown[], layouts: LayoutEntry[]) => {
    setPendingUrl(null);
    pendingUrlRef.current = null;
    setCommittedUrl(url);
    setPageLoaderData(pageLd);
    setLayoutLoaderDatas(layoutLds);
    committedLayoutsRef.current = layouts;
    layoutLoaderDatasRef.current = layoutLds;
    setLoaderError(null);
    setActionData(undefined);
    setNavigationState("idle");
  };

  const carryOverLayoutDatas = (newLayouts: LayoutEntry[], sharedCount: number): unknown[] => {
    const result: unknown[] = [];
    for (let i = 0; i < newLayouts.length; i++) {
      result.push(i < sharedCount ? layoutLoaderDatasRef.current[i] : undefined);
    }
    return result;
  };

  // ナビゲーション開始: キャッシュヒット → 即コミット、guard/loader あり → pending、なし → 即コミット
  const startNavigation = useCallback((to: string) => {
    const toPath = to.split("?")[0];
    const toMatched = findMatchedRoute(routes, toPath);
    const hasGuards = toMatched && toMatched.route.guards.length > 0;
    const hasAnyLoader = toMatched && routeHasLoader(toMatched.route);

    if (hasAnyLoader || hasGuards) {
      // prefetch キャッシュを確認（TTL 内のみ有効、guard なし＋layout 変更なしの場合のみ）
      if (!hasGuards && toMatched) {
        const entry = prefetchCache.current.get(to);
        if (entry && Date.now() - entry.cachedAt < PREFETCH_TTL) {
          const newLayouts = toMatched.route.layouts;
          const sharedCount = getSharedLayoutCount(committedLayoutsRef.current, newLayouts);
          const hasNewLayoutLoaders = newLayouts.slice(sharedCount).some((l) => l.loader);

          if (!hasNewLayoutLoaders) {
            // layout loader は全てスキップ可 + page data はキャッシュ済み → 即コミット
            prefetchCache.current.delete(to);
            const newLayoutDatas = carryOverLayoutDatas(newLayouts, sharedCount);
            commitRoute(to, entry.data, newLayoutDatas, newLayouts);
            return;
          }
        }
        prefetchCache.current.delete(to); // TTL 切れのエントリを削除
      }
      // guard/loader あり → pending にして裏で実行
      setPendingUrl(to);
      pendingUrlRef.current = to;
      setNavigationState("loading");
    } else {
      // guard も loader もなし → 即コミット
      const newLayouts = toMatched?.route.layouts ?? [];
      const sharedCount = getSharedLayoutCount(committedLayoutsRef.current, newLayouts);
      const newLayoutDatas = carryOverLayoutDatas(newLayouts, sharedCount);
      commitRoute(to, undefined, newLayoutDatas, newLayouts);
    }
  }, [routes]);

  // popstate 対応
  useEffect(() => {
    const onPopState = () => {
      const url = window.location.pathname + window.location.search;
      startNavigation(url);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [startNavigation]);

  const navigate = useCallback((to: string | number, options?: { replace?: boolean }) => {
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
  }, [startNavigation]);

  const prefetch = useCallback((to: string) => {
    if (prefetchCache.current.has(to) || prefetchInFlight.current.has(to)) return;
    const toPath = to.split("?")[0];
    const toMatched = findMatchedRoute(routes, toPath);
    if (!toMatched?.route.loader) return;

    prefetchInFlight.current.add(to);
    const toParams = toMatched.params;
    const toSearch = parseSearchParams(to);
    toMatched.route.loader({ params: toParams, search: toSearch }).then(
      (data) => {
        prefetchCache.current.set(to, { data, cachedAt: Date.now() });
        prefetchInFlight.current.delete(to);
      },
      () => {
        prefetchInFlight.current.delete(to);
      },
    );
  }, [routes]);

  // pending ルートの guard → layout loader → page loader 実行
  useEffect(() => {
    if (!pendingUrl) return;

    const pendingPath = pendingUrl.split("?")[0];
    const pendingMatched = findMatchedRoute(routes, pendingPath);

    if (!pendingMatched) {
      commitRoute(pendingUrl, undefined, [], []);
      return;
    }

    let cancelled = false;
    const pendingParams = pendingMatched.params;
    const pendingSearch = parseSearchParams(pendingUrl);
    const targetUrl = pendingUrl;
    const args = { params: pendingParams, search: pendingSearch };

    (async () => {
      // guard を外側から順に実行
      for (const guard of pendingMatched.route.guards) {
        if (cancelled) return;
        await guard(args);
      }

      // layout loader を実行（共通 layout はスキップ）
      const newLayouts = pendingMatched.route.layouts;
      const sharedCount = getSharedLayoutCount(committedLayoutsRef.current, newLayouts);
      const layoutDatas: unknown[] = [];
      for (let i = 0; i < newLayouts.length; i++) {
        if (cancelled) return;
        if (i < sharedCount) {
          layoutDatas.push(layoutLoaderDatasRef.current[i]);
        } else if (newLayouts[i].loader) {
          layoutDatas.push(await newLayouts[i].loader!(args));
        } else {
          layoutDatas.push(undefined);
        }
      }

      // page loader を実行
      const pageData = pendingMatched.route.loader
        ? await pendingMatched.route.loader(args)
        : undefined;

      if (cancelled) return;
      const currentBrowserUrl = window.location.pathname + window.location.search;
      if (currentBrowserUrl !== targetUrl) return;

      setCommittedUrl(targetUrl);
      setPendingUrl(null);
      pendingUrlRef.current = null;
      setPageLoaderData(pageData);
      setLayoutLoaderDatas(layoutDatas);
      committedLayoutsRef.current = newLayouts;
      layoutLoaderDatasRef.current = layoutDatas;
      setLoaderError(null);
      setActionData(undefined);
      setNavigationState("idle");
    })().catch((err) => {
      if (cancelled) return;
      // redirect を catch → navigate で飛ばす
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
      setLoaderError(err instanceof Error ? err : new Error(String(err)));
      setNavigationState("idle");
    });

    return () => { cancelled = true; };
  }, [pendingUrl]);

  // action 後の loader 再実行（loaderKey でトリガー）— layout loader も含む
  useEffect(() => {
    if (loaderKey === 0) return; // 初回は実行しない
    if (!committedMatched || !routeHasLoader(committedMatched.route)) return;

    let cancelled = false;
    const args = { params: committedParams, search: committedSearch };

    (async () => {
      // layout loader を再実行
      const layoutDatas: unknown[] = [];
      for (const layout of committedMatched.route.layouts) {
        if (cancelled) return;
        layoutDatas.push(layout.loader ? await layout.loader(args) : undefined);
      }

      // page loader を再実行
      const pageData = committedMatched.route.loader
        ? await committedMatched.route.loader(args)
        : undefined;

      if (!cancelled) {
        setPageLoaderData(pageData);
        setLayoutLoaderDatas(layoutDatas);
        layoutLoaderDatasRef.current = layoutDatas;
      }
    })().catch((err) => {
      if (!cancelled) {
        setLoaderError(err instanceof Error ? err : new Error(String(err)));
      }
    });

    return () => { cancelled = true; };
  }, [loaderKey]);

  // 初回 guard + loader 実行（ページロード時）
  useEffect(() => {
    if (!committedMatched) {
      setInitialLoadDone(true);
      return;
    }
    const hasGuards = committedMatched.route.guards.length > 0;
    const hasAnyLoader = routeHasLoader(committedMatched.route);
    if (!hasGuards && !hasAnyLoader) {
      setInitialLoadDone(true);
      return;
    }

    let cancelled = false;
    setNavigationState("loading");
    const args = { params: committedParams, search: committedSearch };

    (async () => {
      for (const guard of committedMatched.route.guards) {
        if (cancelled) return;
        await guard(args);
      }

      // layout loader を実行
      const layoutDatas: unknown[] = [];
      for (const layout of committedMatched.route.layouts) {
        if (cancelled) return;
        layoutDatas.push(layout.loader ? await layout.loader(args) : undefined);
      }

      // page loader を実行
      const pageData = committedMatched.route.loader
        ? await committedMatched.route.loader(args)
        : undefined;

      if (!cancelled) {
        setPageLoaderData(pageData);
        setLayoutLoaderDatas(layoutDatas);
        committedLayoutsRef.current = committedMatched.route.layouts;
        layoutLoaderDatasRef.current = layoutDatas;
        setInitialLoadDone(true);
        setNavigationState("idle");
      }
    })().catch((err) => {
      if (cancelled) return;
      if (isRedirectError(err)) {
        setNavigationState("idle");
        navigate(err.to, { replace: err.replace });
        return;
      }
      setLoaderError(err instanceof Error ? err : new Error(String(err)));
      setInitialLoadDone(true);
      setNavigationState("idle");
    });

    return () => { cancelled = true; };
  }, []);

  const submitAction = useCallback(async (payload: FormData | Record<string, unknown>) => {
    const action = committedMatched?.route.action;
    if (!action) {
      throw new Error("この route に action が定義されていません");
    }
    const urlAtSubmit = committedUrlRef.current;
    setNavigationState("submitting");
    try {
      const actionArgs = payload instanceof FormData
        ? { params: committedParams, search: committedSearch, formData: payload }
        : { params: committedParams, search: committedSearch, data: payload };
      const result = await action(actionArgs);
      if (committedUrlRef.current === urlAtSubmit) {
        setActionData(result);
        setNavigationState("idle");
        prefetchCache.current.clear();
        setLoaderKey((k) => k + 1);
      }
    } catch (err) {
      if (isRedirectError(err)) {
        setNavigationState("idle");
        navigate(err.to, { replace: err.replace });
        return;
      }
      if (committedUrlRef.current === urlAtSubmit) {
        setActionData({ error: err });
        setNavigationState("idle");
      }
    }
  }, [committedMatched, committedParams, committedSearch]);

  const stateCtx = useMemo<RouterStateContextValue>(
    () => ({
      currentPath: committedPath,
      params: committedParams,
      search: committedSearch,
      actionData,
      navigationState,
    }),
    [committedPath, committedParams, committedSearch, actionData, navigationState],
  );

  const dispatchCtx = useMemo<RouterDispatchContextValue>(
    () => ({ navigate, submitAction, prefetch }),
    [navigate, submitAction, prefetch],
  );

  // ページコンテンツを決定
  let content: ReactNode;

  if (!committedMatched) {
    content = NotFound ? <NotFound /> : <div>404 — Not Found</div>;
  } else if (loaderError) {
    const ErrorComp = committedMatched.route.ErrorBoundary;
    if (ErrorComp) {
      content = <ErrorComp error={loaderError} />;
    } else {
      throw loaderError;
    }
  } else if (!initialLoadDone && routeHasLoader(committedMatched.route)) {
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

    // page の loader データを Context で提供
    content = <LoaderDataContext.Provider value={pageLoaderData}>{content}</LoaderDataContext.Provider>;
  }

  // layouts を外側から内側にネストして描画（ルートマッチ時のみ）
  if (committedMatched) {
    for (let i = committedMatched.route.layouts.length - 1; i >= 0; i--) {
      const Layout = committedMatched.route.layouts[i].component;
      content = (
        <LoaderDataContext.Provider value={layoutLoaderDatas[i]}>
          <Layout>{content}</Layout>
        </LoaderDataContext.Provider>
      );
    }
  }

  return (
    <RouterStateContext.Provider value={stateCtx}>
      <RouterDispatchContext.Provider value={dispatchCtx}>
        {content}
      </RouterDispatchContext.Provider>
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

function routeHasLoader(route: Route): boolean {
  return !!route.loader || route.layouts.some((l) => !!l.loader);
}

function getSharedLayoutCount(oldLayouts: LayoutEntry[], newLayouts: LayoutEntry[]): number {
  let shared = 0;
  const minLen = Math.min(oldLayouts.length, newLayouts.length);
  for (let i = 0; i < minLen; i++) {
    if (oldLayouts[i].component === newLayouts[i].component) shared++;
    else break;
  }
  return shared;
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
