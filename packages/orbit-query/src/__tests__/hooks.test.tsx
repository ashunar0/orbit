// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { createQueryClient } from "../client";
import { QueryProvider } from "../provider";
import { useQuery } from "../use-query";
import { useMutation } from "../use-mutation";
import type { QueryClient } from "../types";

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryProvider client={client}>{children}</QueryProvider>;
  };
}

describe("useQuery", () => {
  it("fetches data and renders", async () => {
    const client = createQueryClient();

    function UserList() {
      const { data, isLoading } = useQuery({
        key: ["users"],
        fn: async () => ["あさひ", "ずんだもん"],
      });

      if (isLoading) return <div>Loading...</div>;
      return <div>{data?.join(", ")}</div>;
    }

    render(<UserList />, { wrapper: createWrapper(client) });

    expect(screen.getByText("Loading...")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("あさひ, ずんだもん")).toBeDefined();
    });
  });

  it("shows error state", async () => {
    const client = createQueryClient();

    function FailComponent() {
      const { error, isLoading } = useQuery({
        key: ["fail"],
        fn: async () => {
          throw new Error("API error");
        },
      });

      if (isLoading) return <div>Loading...</div>;
      if (error) return <div>Error: {error.message}</div>;
      return <div>OK</div>;
    }

    render(<FailComponent />, { wrapper: createWrapper(client) });

    await waitFor(() => {
      expect(screen.getByText("Error: API error")).toBeDefined();
    });
  });

  it("does not fetch when enabled is false", async () => {
    const client = createQueryClient();
    const fn = vi.fn(async () => "data");

    function Component() {
      const { data, isLoading } = useQuery({
        key: ["disabled"],
        fn,
        enabled: false,
      });

      return <div>{isLoading ? "loading" : (data ?? "no data")}</div>;
    }

    render(<Component />, { wrapper: createWrapper(client) });

    // enabled: false なので fetch されない
    expect(fn).not.toHaveBeenCalled();
    expect(screen.getByText("no data")).toBeDefined();
  });

  it("uses cached data from fetchQuery (loader pattern)", async () => {
    const client = createQueryClient();
    const fn = vi.fn(async () => "cached-data");

    // loader が先にキャッシュに入れる
    await client.fetchQuery({ key: ["preloaded"], fn });
    fn.mockClear();

    function Component() {
      const { data } = useQuery({
        key: ["preloaded"],
        fn,
        staleTime: 60_000,
      });

      return <div>{data ?? "no data"}</div>;
    }

    render(<Component />, { wrapper: createWrapper(client) });

    await waitFor(() => {
      expect(screen.getByText("cached-data")).toBeDefined();
    });

    // staleTime 内なのでリフェッチされない
    expect(fn).not.toHaveBeenCalled();
  });

  it("refetch triggers new fetch", async () => {
    const client = createQueryClient();
    let count = 0;

    function Counter() {
      const { data, refetch } = useQuery({
        key: ["counter"],
        fn: async () => {
          count++;
          return `count-${count}`;
        },
      });

      return (
        <div>
          <span>{data ?? "loading"}</span>
          <button onClick={refetch}>refetch</button>
        </div>
      );
    }

    render(<Counter />, { wrapper: createWrapper(client) });

    await waitFor(() => {
      expect(screen.getByText("count-1")).toBeDefined();
    });

    await act(async () => {
      screen.getByText("refetch").click();
    });

    await waitFor(() => {
      expect(screen.getByText("count-2")).toBeDefined();
    });
  });
});

describe("useMutation", () => {
  it("executes mutation and returns data", async () => {
    const client = createQueryClient();

    let result: string | undefined;

    function Component() {
      const { mutate, isSubmitting } = useMutation({
        fn: async (name: string) => `Hello, ${name}`,
      });

      return (
        <div>
          <span>{isSubmitting ? "submitting" : "idle"}</span>
          <button
            onClick={async () => {
              result = await mutate("あさひ");
            }}
          >
            submit
          </button>
        </div>
      );
    }

    render(<Component />, { wrapper: createWrapper(client) });

    expect(screen.getByText("idle")).toBeDefined();

    await act(async () => {
      screen.getByText("submit").click();
    });

    await waitFor(() => {
      expect(screen.getByText("idle")).toBeDefined();
    });

    expect(result).toBe("Hello, あさひ");
  });

  it("invalidates queries on success", async () => {
    const client = createQueryClient();
    let fetchCount = 0;

    function Component() {
      const { data } = useQuery({
        key: ["users"],
        fn: async () => {
          fetchCount++;
          return `fetch-${fetchCount}`;
        },
      });

      const { mutate } = useMutation({
        fn: async () => "created",
        invalidate: ["users"],
      });

      return (
        <div>
          <span>{data ?? "loading"}</span>
          <button onClick={() => mutate(undefined)}>create</button>
        </div>
      );
    }

    render(<Component />, { wrapper: createWrapper(client) });

    await waitFor(() => {
      expect(screen.getByText("fetch-1")).toBeDefined();
    });

    await act(async () => {
      screen.getByText("create").click();
    });

    await waitFor(() => {
      expect(screen.getByText("fetch-2")).toBeDefined();
    });
  });

  it("shows error on mutation failure", async () => {
    const client = createQueryClient();

    function Component() {
      const { mutate, error } = useMutation({
        fn: async () => {
          throw new Error("mutation failed");
        },
      });

      return (
        <div>
          <span>{error ? error.message : "no error"}</span>
          <button
            onClick={async () => {
              try {
                await mutate(undefined);
              } catch {
                // expected
              }
            }}
          >
            trigger-error
          </button>
        </div>
      );
    }

    render(<Component />, { wrapper: createWrapper(client) });

    await act(async () => {
      screen.getByText("trigger-error").click();
    });

    await waitFor(() => {
      expect(screen.getByText("mutation failed")).toBeDefined();
    });
  });

  it("calls onSuccess callback", async () => {
    const client = createQueryClient();
    const onSuccess = vi.fn();

    function Component() {
      const { mutate } = useMutation({
        fn: async (x: number) => x * 2,
        onSuccess,
      });

      return <button onClick={() => mutate(5)}>go</button>;
    }

    render(<Component />, { wrapper: createWrapper(client) });

    await act(async () => {
      screen.getByText("go").click();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(10);
    });
  });
});
