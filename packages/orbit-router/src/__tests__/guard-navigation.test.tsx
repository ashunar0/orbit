// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import { Router } from "../runtime/router";
import { useSearchParams, useNavigate } from "../runtime/hooks";
import { redirect } from "../runtime/redirect";

function StaticPage() {
  return <div>Static Page</div>;
}

function LoadingComp() {
  return <div>Loading...</div>;
}

function ErrorComp({ error }: { error: Error }) {
  return <div>Error: {error.message}</div>;
}

function SearchPage() {
  const [raw] = useSearchParams();
  return <div>Query: {raw.q ?? "none"}</div>;
}

function SearchSchemaPage() {
  const [{ page }] = useSearchParams((raw) => ({
    page: Number(raw.page ?? 1),
  }));
  return <div>Page: {page}</div>;
}

function SetSearchPage() {
  const [raw, setSearch] = useSearchParams();
  return (
    <div>
      <div>Query: {raw.q ?? "none"}</div>
      <div>Sort: {raw.sort ?? "none"}</div>
      <button onClick={() => setSearch({ q: "world" })}>Set Q</button>
      <button onClick={() => setSearch({ q: null })}>Remove Q</button>
      <button onClick={() => setSearch({ q: "updated", sort: "name" })}>Set Both</button>
      <button onClick={() => setSearch({ q: "replaced" }, { replace: true })}>Replace Q</button>
    </div>
  );
}

// --- Guard テスト用 ---
let guardCallCount = 0;

const fakeGuard = async () => {
  guardCallCount++;
};

const redirectGuard = async () => {
  throw redirect("/static");
};

const failingGuard = async () => {
  throw new Error("guard failed");
};

function GuardedPage() {
  return <div data-testid="guarded-page">Guarded Content</div>;
}

function TriggerPage() {
  const navigate = useNavigate();
  return (
    <div>
      <div data-testid="trigger-page">Trigger</div>
      <button data-testid="nav-guarded" onClick={() => navigate("/guarded")}>Go Guarded</button>
    </div>
  );
}

const searchRoutes = [
  { path: "/search", component: SearchPage, layouts: [], guards: [] },
  { path: "/search-schema", component: SearchSchemaPage, layouts: [], guards: [] },
];

const setSearchRoutes = [
  { path: "/set-search", component: SetSearchPage, layouts: [], guards: [] },
];

const guardRoutes = [
  { path: "/static", component: StaticPage, layouts: [], guards: [] },
  { path: "/trigger", component: TriggerPage, layouts: [], guards: [] },
  { path: "/guarded", component: GuardedPage, layouts: [], guards: [fakeGuard], Loading: LoadingComp },
  { path: "/redirect-guard", component: GuardedPage, layouts: [], guards: [redirectGuard] },
  { path: "/error-guard", component: GuardedPage, layouts: [], guards: [failingGuard], ErrorBoundary: ErrorComp },
];

describe("useSearchParams", () => {
  afterEach(cleanup);

  it("returns raw search params", () => {
    window.history.pushState(null, "", "/search?q=hello");
    render(<Router routes={searchRoutes} />);
    expect(screen.getByText("Query: hello")).toBeDefined();
  });

  it("returns empty record when no search params", () => {
    window.history.pushState(null, "", "/search");
    render(<Router routes={searchRoutes} />);
    expect(screen.getByText("Query: none")).toBeDefined();
  });

  it("validates with Zod schema", () => {
    window.history.pushState(null, "", "/search-schema?page=3");
    render(<Router routes={searchRoutes} />);
    expect(screen.getByText("Page: 3")).toBeDefined();
  });

  it("applies Zod defaults when param is missing", () => {
    window.history.pushState(null, "", "/search-schema");
    render(<Router routes={searchRoutes} />);
    expect(screen.getByText("Page: 1")).toBeDefined();
  });

  it("setSearchParams merges new params into URL", async () => {
    window.history.pushState(null, "", "/set-search?sort=date");
    render(<Router routes={setSearchRoutes} />);
    expect(screen.getByText("Sort: date")).toBeDefined();

    await act(async () => {
      screen.getByText("Set Q").click();
    });

    await waitFor(() => {
      expect(screen.getByText("Query: world")).toBeDefined();
      expect(screen.getByText("Sort: date")).toBeDefined();
    });
  });

  it("setSearchParams with replace: true uses replaceState", async () => {
    window.history.pushState(null, "", "/set-search?q=hello");
    render(<Router routes={setSearchRoutes} />);
    expect(screen.getByText("Query: hello")).toBeDefined();

    const lengthBefore = window.history.length;

    await act(async () => {
      screen.getByText("Replace Q").click();
    });

    await waitFor(() => {
      expect(screen.getByText("Query: replaced")).toBeDefined();
    });
    expect(window.history.length).toBe(lengthBefore);
  });

  it("setSearchParams removes param when value is null", async () => {
    window.history.pushState(null, "", "/set-search?q=hello&sort=date");
    render(<Router routes={setSearchRoutes} />);
    expect(screen.getByText("Query: hello")).toBeDefined();

    await act(async () => {
      screen.getByText("Remove Q").click();
    });

    await waitFor(() => {
      expect(screen.getByText("Query: none")).toBeDefined();
      expect(screen.getByText("Sort: date")).toBeDefined();
    });
  });
});

describe("Guard", () => {
  beforeEach(() => {
    guardCallCount = 0;
    window.history.pushState(null, "", "/");
  });

  afterEach(cleanup);

  it("guard が通過するとページが表示される", async () => {
    window.history.pushState(null, "", "/trigger");
    render(<Router routes={guardRoutes} />);

    await act(async () => {
      screen.getByTestId("nav-guarded").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("guarded-page").textContent).toBe("Guarded Content");
    });
    expect(guardCallCount).toBe(1);
  });

  it("guard なしのページは即座に表示される", () => {
    window.history.pushState(null, "", "/static");
    render(<Router routes={guardRoutes} />);
    expect(screen.getByText("Static Page")).toBeDefined();
  });

  it("guard で redirect するとリダイレクト先が表示される", async () => {
    window.history.pushState(null, "", "/redirect-guard");
    render(<Router routes={guardRoutes} />);

    await waitFor(() => {
      expect(screen.getByText("Static Page")).toBeDefined();
    });
  });

  it("guard がエラーを投げると ErrorBoundary が表示される", async () => {
    window.history.pushState(null, "", "/error-guard");
    render(<Router routes={guardRoutes} />);

    await waitFor(() => {
      expect(screen.getByText("Error: guard failed")).toBeDefined();
    });
  });

  it("ナビゲーション時に guard が毎回実行される", async () => {
    window.history.pushState(null, "", "/trigger");
    render(<Router routes={guardRoutes} />);

    // 1回目
    await act(async () => {
      screen.getByTestId("nav-guarded").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("guarded-page")).toBeTruthy();
    });
    expect(guardCallCount).toBe(1);

    // trigger に戻る
    await act(async () => {
      window.history.pushState(null, "", "/trigger");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("trigger-page")).toBeTruthy();
    });

    // 2回目
    await act(async () => {
      screen.getByTestId("nav-guarded").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("guarded-page")).toBeTruthy();
    });
    expect(guardCallCount).toBe(2);
  });
});
