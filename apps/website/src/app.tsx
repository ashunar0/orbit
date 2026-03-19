import { routes } from "virtual:orbit-router/routes";

export function App() {
  // Phase 1: 最小限の CSR ルーター
  // 現在の URL パスに一致するルートを表示する
  const currentPath = window.location.pathname;
  const match = routes.find((r) => r.path === currentPath) ?? routes[0];

  if (!match) {
    return <div>No routes found. Add an index.tsx to src/routes/</div>;
  }

  const Page = match.component;
  const Layout = match.layout;

  if (Layout) {
    return (
      <Layout>
        <Page />
      </Layout>
    );
  }

  return <Page />;
}
