// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import { Router } from "../runtime/router";
import { useLoaderData, useActionData, useSubmit, useSearchParams } from "../runtime/hooks";
import { Form } from "../runtime/form";

function LoaderPage() {
  const data = useLoaderData<typeof fakeLoader>() as { message: string };
  return <div>Loaded: {data.message}</div>;
}

function LoadingComp() {
  return <div>Loading...</div>;
}

function ErrorComp({ error }: { error: Error }) {
  return <div>Error: {error.message}</div>;
}

function NoLoaderPage() {
  return <div>Static Page</div>;
}

function SearchPage() {
  const raw = useSearchParams();
  return <div>Query: {raw.q ?? "none"}</div>;
}

function SearchSchemaPage() {
  const { page } = useSearchParams((raw) => ({
    page: Number(raw.page ?? 1),
  }));
  return <div>Page: {page}</div>;
}

function ActionPage() {
  const data = useLoaderData<typeof actionPageLoader>() as { count: number };
  const actionResult = useActionData<typeof fakeAction>();
  const submit = useSubmit();

  return (
    <div>
      <div>Count: {data.count}</div>
      {actionResult && <div>Action result: {String(actionResult.ok)}</div>}
      <button onClick={() => submit(new FormData())}>Submit</button>
    </div>
  );
}

function JsonActionPage() {
  const actionResult = useActionData<typeof jsonAction>();
  const submit = useSubmit();

  return (
    <div>
      {actionResult && <div>Received: {JSON.stringify(actionResult.received)}</div>}
      <button onClick={() => submit({ email: "test@example.com", password: "secret" })}>Submit JSON</button>
    </div>
  );
}

function FormActionPage() {
  const actionResult = useActionData<typeof fakeAction>();
  return (
    <div>
      {actionResult && <div>Form result: {String(actionResult.ok)}</div>}
      <Form>
        <input name="name" defaultValue="test" />
        <button type="submit">Submit Form</button>
      </Form>
    </div>
  );
}

function JsonFormActionPage() {
  const actionResult = useActionData<typeof jsonAction>();
  return (
    <div>
      {actionResult && <div>JSON Form: {JSON.stringify(actionResult.received)}</div>}
      <Form json>
        <input name="email" defaultValue="form@example.com" />
        <button type="submit">Submit JSON Form</button>
      </Form>
    </div>
  );
}

function RootLayout({ children }: { children: React.ReactNode }) {
  return <div data-testid="layout">{children}</div>;
}

let actionCallCount = 0;

const actionPageLoader = async () => {
  return { count: actionCallCount };
};

const fakeAction = async ({ formData }: { params: Record<string, string>; search: Record<string, string>; formData?: FormData }) => {
  actionCallCount++;
  return { ok: true };
};

const jsonAction = async ({ data }: { params: Record<string, string>; search: Record<string, string>; data?: unknown }) => {
  actionCallCount++;
  return { received: data };
};

const fakeLoader = async () => {
  return { message: "hello" };
};

const slowLoader = async () => {
  await new Promise((r) => setTimeout(r, 100));
  return { message: "loaded" };
};

const failingLoader = async () => {
  throw new Error("load failed");
};

const routes = [
  {
    path: "/loader",
    component: LoaderPage,
    layouts: [RootLayout], guards: [],
    loader: fakeLoader,
    Loading: LoadingComp,
    ErrorBoundary: ErrorComp,
  },
  {
    path: "/slow",
    component: LoaderPage,
    layouts: [RootLayout], guards: [],
    loader: slowLoader,
    Loading: LoadingComp,
  },
  {
    path: "/error",
    component: LoaderPage,
    layouts: [RootLayout], guards: [],
    loader: failingLoader,
    ErrorBoundary: ErrorComp,
  },
  {
    path: "/static",
    component: NoLoaderPage,
    layouts: [RootLayout], guards: [],
  },
  {
    path: "/search",
    component: SearchPage,
    layouts: [], guards: [],
  },
  {
    path: "/search-schema",
    component: SearchSchemaPage,
    layouts: [], guards: [],
  },
  {
    path: "/action",
    component: ActionPage,
    layouts: [], guards: [],
    loader: actionPageLoader,
    action: fakeAction,
    Loading: LoadingComp,
  },
  {
    path: "/json-action",
    component: JsonActionPage,
    layouts: [], guards: [],
    action: jsonAction,
  },
  {
    path: "/form-action",
    component: FormActionPage,
    layouts: [], guards: [],
    action: fakeAction,
  },
  {
    path: "/json-form-action",
    component: JsonFormActionPage,
    layouts: [], guards: [],
    action: jsonAction,
  },
];

describe("Loader", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/");
  });

  afterEach(cleanup);

  it("calls loader and renders data via useLoaderData", async () => {
    window.history.pushState(null, "", "/loader");
    render(<Router routes={routes} />);
    await waitFor(() => {
      expect(screen.getByText("Loaded: hello")).toBeDefined();
    });
  });

  it("shows Loading component while loader is pending", async () => {
    window.history.pushState(null, "", "/slow");
    render(<Router routes={routes} />);
    // Loading が表示される
    expect(screen.getByText("Loading...")).toBeDefined();
    // loader 完了後にデータが表示される
    await waitFor(() => {
      expect(screen.getByText("Loaded: loaded")).toBeDefined();
    });
  });

  it("shows blank when loading without Loading component", async () => {
    const routesNoLoading = [
      {
        path: "/no-loading",
        component: LoaderPage,
        layouts: [], guards: [],
        loader: slowLoader,
      },
    ];
    window.history.pushState(null, "", "/no-loading");
    const { container } = render(<Router routes={routesNoLoading} />);
    // Loading コンポーネントがないので何も表示されない
    expect(container.textContent).toBe("");
  });

  it("shows ErrorBoundary when loader throws", async () => {
    window.history.pushState(null, "", "/error");
    render(<Router routes={routes} />);
    await waitFor(() => {
      expect(screen.getByText("Error: load failed")).toBeDefined();
    });
  });

  it("keeps layout when loader throws", async () => {
    window.history.pushState(null, "", "/error");
    render(<Router routes={routes} />);
    await waitFor(() => {
      expect(screen.getByText("Error: load failed")).toBeDefined();
    });
    expect(screen.getByTestId("layout")).toBeDefined();
  });

  it("renders static page without loader", () => {
    window.history.pushState(null, "", "/static");
    render(<Router routes={routes} />);
    expect(screen.getByText("Static Page")).toBeDefined();
  });
});

describe("useSearchParams", () => {
  afterEach(cleanup);

  it("returns raw search params", () => {
    window.history.pushState(null, "", "/search?q=hello");
    render(<Router routes={routes} />);
    expect(screen.getByText("Query: hello")).toBeDefined();
  });

  it("returns empty record when no search params", () => {
    window.history.pushState(null, "", "/search");
    render(<Router routes={routes} />);
    expect(screen.getByText("Query: none")).toBeDefined();
  });

  it("validates with Zod schema", () => {
    window.history.pushState(null, "", "/search-schema?page=3");
    render(<Router routes={routes} />);
    expect(screen.getByText("Page: 3")).toBeDefined();
  });

  it("applies Zod defaults when param is missing", () => {
    window.history.pushState(null, "", "/search-schema");
    render(<Router routes={routes} />);
    expect(screen.getByText("Page: 1")).toBeDefined();
  });
});

describe("Action", () => {
  beforeEach(() => {
    actionCallCount = 0;
    window.history.pushState(null, "", "/");
  });

  afterEach(cleanup);

  it("calls action and returns result via useActionData", async () => {
    window.history.pushState(null, "", "/action");
    render(<Router routes={routes} />);
    await waitFor(() => {
      expect(screen.getByText("Count: 0")).toBeDefined();
    });

    await act(async () => {
      screen.getByText("Submit").click();
    });

    await waitFor(() => {
      expect(screen.getByText("Action result: true")).toBeDefined();
    });
  });

  it("re-runs loader after action completes", async () => {
    window.history.pushState(null, "", "/action");
    render(<Router routes={routes} />);
    await waitFor(() => {
      expect(screen.getByText("Count: 0")).toBeDefined();
    });

    await act(async () => {
      screen.getByText("Submit").click();
    });

    await waitFor(() => {
      expect(screen.getByText("Count: 1")).toBeDefined();
    });
  });

  it("submits JSON object and receives it via data arg", async () => {
    window.history.pushState(null, "", "/json-action");
    render(<Router routes={routes} />);

    await act(async () => {
      screen.getByText("Submit JSON").click();
    });

    await waitFor(() => {
      expect(screen.getByText('Received: {"email":"test@example.com","password":"secret"}')).toBeDefined();
    });
  });

  it("<Form> submits FormData to action", async () => {
    window.history.pushState(null, "", "/form-action");
    render(<Router routes={routes} />);

    await act(async () => {
      screen.getByText("Submit Form").click();
    });

    await waitFor(() => {
      expect(screen.getByText("Form result: true")).toBeDefined();
    });
  });

  it("<Form json> submits JSON object to action", async () => {
    window.history.pushState(null, "", "/json-form-action");
    render(<Router routes={routes} />);

    await act(async () => {
      screen.getByText("Submit JSON Form").click();
    });

    await waitFor(() => {
      expect(screen.getByText('JSON Form: {"email":"form@example.com"}')).toBeDefined();
    });
  });

});
