import { createContext, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { matchRoute } from "./match";

type LayoutComponent = ComponentType<{ children: ReactNode }>;

interface Route {
  path: string;
  component: ComponentType;
  layouts: LayoutComponent[];
}

interface RouterContextValue {
  currentPath: string;
  params: Record<string, string>;
  navigate: (to: string) => void;
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

  // P1-09: popstate 対応（戻る/進むボタン）
  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (to: string) => {
    if (to === currentPath) return;
    window.history.pushState(null, "", to);
    setCurrentPath(to);
  };

  // ルートマッチング（静的 → 動的の順でスキャン済み）
  const matched = findMatchedRoute(routes, currentPath);

  const ctx = useMemo<RouterContextValue>(
    () => ({ currentPath, params: matched?.params ?? {}, navigate }),
    [currentPath, matched],
  );

  if (!matched) {
    return <div>No routes found. Add a page.tsx to src/routes/</div>;
  }

  // layouts を外側から内側にネストして描画
  // [RootLayout, UsersLayout] + Page → <RootLayout><UsersLayout><Page /></UsersLayout></RootLayout>
  const Page = matched.route.component;
  let content: ReactNode = <Page />;

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
