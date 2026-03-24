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
  ErrorBoundary?: ComponentType<{ error: Error }>;
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
const LayoutDataContext = createContext<unknown>(undefined);

export function useLoaderDataContext(): unknown {
  return useContext(LoaderDataContext);
}

export function useLayoutDataContext(): unknown {
  return useContext(LayoutDataContext);
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
  ErrorFallback?: ComponentType<{ error: Error }>;
}

export function Router({ routes, NotFound, ErrorFallback }: RouterProps) {
  // committedUrl = 表示中のルート、pendingUrl = 遷移先（loader 実行中）
  const [committedUrl, setCommittedUrl] = useState(() => window.location.pathname + window.location.search);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const [pageLoaderData, setPageLoaderData] = useState<unknown>(undefined);
  const [layoutLoaderDatas, setLayoutLoaderDatas] = useState<unknown[]>([]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [actionData, setActionData] = useState<unknown>(undefined);
  // loaderError: エラー本体 + 失敗した階層（バブリング開始位置を決めるため）
  const [loaderError, setLoaderError] = useState<{ error: Error; origin: ErrorOrigin } | null>(null);
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
    const controller = new AbortController();
    toMatched.route.loader({ params: toParams, search: toSearch, signal: controller.signal }).then(
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

    const controller = new AbortController();
    const pendingParams = pendingMatched.params;
    const pendingSearch = parseSearchParams(pendingUrl);
    const targetUrl = pendingUrl;
    const args = { params: pendingParams, search: pendingSearch, signal: controller.signal };

    let errorOrigin: ErrorOrigin = { kind: "page" };

    (async () => {
      // guard を外側から順に実行
      errorOrigin = { kind: "guard" };
      for (const guard of pendingMatched.route.guards) {
        if (controller.signal.aborted) return;
        await guard(args);
      }

      if (controller.signal.aborted) return;

      // guard 通過後: prefetch キャッシュを確認（guard ありルートでもキャッシュを活用）
      const newLayouts = pendingMatched.route.layouts;
      const sharedCount = getSharedLayoutCount(committedLayoutsRef.current, newLayouts);
      const hasNewLayoutLoaders = newLayouts.slice(sharedCount).some((l) => l.loader);

      const cacheEntry = prefetchCache.current.get(targetUrl);
      if (cacheEntry && Date.now() - cacheEntry.cachedAt < PREFETCH_TTL && !hasNewLayoutLoaders) {
        // キャッシュヒット + 新規 layout loader なし → loader スキップして即コミット
        prefetchCache.current.delete(targetUrl);
        const newLayoutDatas = carryOverLayoutDatas(newLayouts, sharedCount);
        if (!controller.signal.aborted) {
          commitRoute(targetUrl, cacheEntry.data, newLayoutDatas, newLayouts);
        }
        return;
      }
      prefetchCache.current.delete(targetUrl); // TTL 切れのエントリを削除

      const layoutDatas: unknown[] = [];
      for (let i = 0; i < newLayouts.length; i++) {
        if (controller.signal.aborted) return;
        if (i < sharedCount) {
          layoutDatas.push(layoutLoaderDatasRef.current[i]);
        } else if (newLayouts[i].loader) {
          errorOrigin = { kind: "layout", index: i };
          layoutDatas.push(await newLayouts[i].loader!(args));
        } else {
          layoutDatas.push(undefined);
        }
      }

      // page loader を実行
      errorOrigin = { kind: "page" };
      const pageData = pendingMatched.route.loader
        ? await pendingMatched.route.loader(args)
        : undefined;

      if (controller.signal.aborted) return;
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
      if (controller.signal.aborted) return;
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
      const error = err instanceof Error ? err : new Error(String(err));
      setLoaderError({ error, origin: errorOrigin });
      setNavigationState("idle");
    });

    return () => { controller.abort(); };
  }, [pendingUrl]);

  // action 後の loader 再実行（loaderKey でトリガー）— layout loader も含む
  useEffect(() => {
    if (loaderKey === 0) return; // 初回は実行しない
    if (!committedMatched || !routeHasLoader(committedMatched.route)) return;

    const controller = new AbortController();
    const args = { params: committedParams, search: committedSearch, signal: controller.signal };
    let errorOrigin: ErrorOrigin = { kind: "page" };

    (async () => {
      // layout loader を再実行
      const layoutDatas: unknown[] = [];
      for (let i = 0; i < committedMatched.route.layouts.length; i++) {
        if (controller.signal.aborted) return;
        const layout = committedMatched.route.layouts[i];
        if (layout.loader) {
          errorOrigin = { kind: "layout", index: i };
          layoutDatas.push(await layout.loader(args));
        } else {
          layoutDatas.push(undefined);
        }
      }

      // page loader を再実行
      errorOrigin = { kind: "page" };
      const pageData = committedMatched.route.loader
        ? await committedMatched.route.loader(args)
        : undefined;

      if (!controller.signal.aborted) {
        setPageLoaderData(pageData);
        setLayoutLoaderDatas(layoutDatas);
        layoutLoaderDatasRef.current = layoutDatas;
      }
    })().catch((err) => {
      if (!controller.signal.aborted) {
        const error = err instanceof Error ? err : new Error(String(err));
        setLoaderError({ error, origin: errorOrigin });
      }
    });

    return () => { controller.abort(); };
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

    const controller = new AbortController();
    setNavigationState("loading");
    const args = { params: committedParams, search: committedSearch, signal: controller.signal };
    let errorOrigin: ErrorOrigin = { kind: "page" };

    (async () => {
      errorOrigin = { kind: "guard" };
      for (const guard of committedMatched.route.guards) {
        if (controller.signal.aborted) return;
        await guard(args);
      }

      // layout loader を実行
      const layoutDatas: unknown[] = [];
      for (let i = 0; i < committedMatched.route.layouts.length; i++) {
        if (controller.signal.aborted) return;
        const layout = committedMatched.route.layouts[i];
        if (layout.loader) {
          errorOrigin = { kind: "layout", index: i };
          layoutDatas.push(await layout.loader(args));
        } else {
          layoutDatas.push(undefined);
        }
      }

      // page loader を実行
      errorOrigin = { kind: "page" };
      const pageData = committedMatched.route.loader
        ? await committedMatched.route.loader(args)
        : undefined;

      if (!controller.signal.aborted) {
        setPageLoaderData(pageData);
        setLayoutLoaderDatas(layoutDatas);
        committedLayoutsRef.current = committedMatched.route.layouts;
        layoutLoaderDatasRef.current = layoutDatas;
        setInitialLoadDone(true);
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
      setLoaderError({ error, origin: errorOrigin });
      setInitialLoadDone(true);
      setNavigationState("idle");
    });

    return () => { controller.abort(); };
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
    // loader エラー: 失敗した階層から親方向に最も近い ErrorBoundary を探す
    const ErrorComp = findNearestErrorBoundary(committedMatched.route, loaderError.origin);
    if (ErrorComp) {
      content = <ErrorComp error={loaderError.error} />;
    } else if (ErrorFallback) {
      content = <ErrorFallback error={loaderError.error} />;
    } else {
      throw loaderError.error;
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

    // page レベルの ErrorBoundary（render エラーキャッチ用）
    if (committedMatched.route.ErrorBoundary) {
      content = <RouteErrorBoundary key={committedPath} fallback={committedMatched.route.ErrorBoundary}>{content}</RouteErrorBoundary>;
    }

    // page の loader データを Context で提供
    // LayoutDataContext = 直近の親 layout の loader data（page 内から useLayoutData() で取得可能）
    const innermostLayoutData = committedMatched.route.layouts.length > 0
      ? layoutLoaderDatas[committedMatched.route.layouts.length - 1]
      : undefined;
    content = (
      <LayoutDataContext.Provider value={innermostLayoutData}>
        <LoaderDataContext.Provider value={pageLoaderData}>{content}</LoaderDataContext.Provider>
      </LayoutDataContext.Provider>
    );
  }

  // layouts を外側から内側にネストして描画（ルートマッチ時のみ）
  // ErrorBoundary は layout の内側（children を包む位置）に配置する。
  // これにより layout 自身のエラーは親の ErrorBoundary でキャッチされ、Next.js と同じ挙動になる。
  // 結果のツリー: Layout0 > [EB0] > Layout1 > [EB1] > Page
  if (committedMatched) {
    for (let i = committedMatched.route.layouts.length - 1; i >= 0; i--) {
      const layout = committedMatched.route.layouts[i];
      const Layout = layout.component;
      // ErrorBoundary は Layout の内側に配置（children のエラーだけキャッチ）
      if (layout.ErrorBoundary) {
        content = <RouteErrorBoundary key={`${committedPath}-layout-${i}`} fallback={layout.ErrorBoundary}>{content}</RouteErrorBoundary>;
      }
      // 親 layout の loader data を LayoutDataContext で提供（最外側は undefined）
      const parentLayoutData = i > 0 ? layoutLoaderDatas[i - 1] : undefined;
      content = (
        <LayoutDataContext.Provider value={parentLayoutData}>
          <LoaderDataContext.Provider value={layoutLoaderDatas[i]}>
            <Layout>{content}</Layout>
          </LoaderDataContext.Provider>
        </LayoutDataContext.Provider>
      );
    }
  }

  // Router レベルの ErrorFallback（最外殻 — どの error.tsx にもキャッチされなかった render エラー用）
  if (ErrorFallback) {
    content = <RouteErrorBoundary key="router-fallback" fallback={ErrorFallback}>{content}</RouteErrorBoundary>;
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

/** エラーの発生元を表す型 */
type ErrorOrigin =
  | { kind: "page" }
  | { kind: "layout"; index: number }
  | { kind: "guard" };

/**
 * エラー発生元から親方向に最も近い ErrorBoundary を探す。
 *
 * - page エラー → page の ErrorBoundary → 内側 layout → ... → 外側 layout
 * - layout[i] エラー → layout[i] は自分自身をキャッチしない → layout[i-1] → ... → layout[0]
 * - guard エラー → page と同じ扱い（guard は全体のゲートなので最も近い EB を使う）
 */
function findNearestErrorBoundary(route: Route, origin: ErrorOrigin): ComponentType<{ error: Error }> | undefined {
  if (origin.kind === "page" || origin.kind === "guard") {
    // page / guard エラー: page EB → 内側 layout → 外側 layout
    if (route.ErrorBoundary) return route.ErrorBoundary;
    for (let i = route.layouts.length - 1; i >= 0; i--) {
      if (route.layouts[i].ErrorBoundary) return route.layouts[i].ErrorBoundary;
    }
  } else {
    // layout[i] エラー: layout[i] の EB は自身をキャッチしない → i-1 から外側へ探索
    for (let i = origin.index - 1; i >= 0; i--) {
      if (route.layouts[i].ErrorBoundary) return route.layouts[i].ErrorBoundary;
    }
  }
  return undefined;
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
