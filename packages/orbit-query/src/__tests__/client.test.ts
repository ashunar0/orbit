import { describe, it, expect, vi } from "vitest";
import { createQueryClient } from "../client";

describe("createQueryClient", () => {
  it("returns a plain object, not a class instance", () => {
    const client = createQueryClient();
    expect(Object.getPrototypeOf(client)).toBe(Object.prototype);
  });

  describe("fetchQuery", () => {
    it("fetches data and stores in cache", async () => {
      const client = createQueryClient();
      const data = await client.fetchQuery({
        key: ["users"],
        fn: async () => [{ id: 1, name: "あさひ" }],
      });

      expect(data).toEqual([{ id: 1, name: "あさひ" }]);
      expect(client.getQueryData(["users"])).toEqual(data);
    });

    it("provides AbortSignal to fetch function", async () => {
      const client = createQueryClient();
      let receivedSignal: AbortSignal | undefined;

      await client.fetchQuery({
        key: ["test"],
        fn: async ({ signal }) => {
          receivedSignal = signal;
          return "ok";
        },
      });

      expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });

    it("updates snapshot status through lifecycle", async () => {
      const client = createQueryClient();

      expect(client.getSnapshot(["users"]).status).toBe("idle");

      const promise = client.fetchQuery({
        key: ["users"],
        fn: async () => {
          return "data";
        },
      });

      // fetch 開始後は loading
      expect(client.getSnapshot(["users"]).status).toBe("loading");
      expect(client.getSnapshot(["users"]).isFetching).toBe(true);

      await promise;

      expect(client.getSnapshot(["users"]).status).toBe("success");
      expect(client.getSnapshot(["users"]).isFetching).toBe(false);
    });

    it("sets error state on failure", async () => {
      const client = createQueryClient();

      await expect(
        client.fetchQuery({
          key: ["fail"],
          fn: async () => {
            throw new Error("network error");
          },
        }),
      ).rejects.toThrow("network error");

      const snapshot = client.getSnapshot(["fail"]);
      expect(snapshot.status).toBe("error");
      expect(snapshot.error?.message).toBe("network error");
    });
  });

  describe("subscribe / notify", () => {
    it("notifies subscribers on state change", async () => {
      const client = createQueryClient();
      const callback = vi.fn();

      client.subscribe(["users"], callback);

      await client.fetchQuery({
        key: ["users"],
        fn: async () => "data",
      });

      // loading 通知 + success 通知
      expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("unsubscribe stops notifications", async () => {
      const client = createQueryClient();
      const callback = vi.fn();

      const unsubscribe = client.subscribe(["users"], callback);
      unsubscribe();

      await client.fetchQuery({
        key: ["users"],
        fn: async () => "data",
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("invalidate", () => {
    it("invalidates matching keys by prefix", async () => {
      const client = createQueryClient();
      const fetchUser = vi.fn(async () => "user-1");
      const fetchList = vi.fn(async () => ["user-1", "user-2"]);

      // キャッシュをセット
      await client.fetchQuery({ key: ["users"], fn: fetchList });
      await client.fetchQuery({ key: ["users", "1"], fn: fetchUser });

      // subscriber を登録（invalidate でリフェッチされるために必要）
      client.subscribe(["users"], () => {});
      client.subscribe(["users", "1"], () => {});

      // ensureFetch で refetch 関数を登録
      client.ensureFetch({ key: ["users"], fn: fetchList });
      client.ensureFetch({ key: ["users", "1"], fn: fetchUser });

      fetchList.mockClear();
      fetchUser.mockClear();

      // ["users"] プレフィックスで invalidate
      client.invalidate(["users"]);

      // 両方リフェッチされる
      expect(fetchList).toHaveBeenCalledTimes(1);
      expect(fetchUser).toHaveBeenCalledTimes(1);
    });

    it("does not invalidate non-matching keys", async () => {
      const client = createQueryClient();
      const fetchPosts = vi.fn(async () => "posts");

      await client.fetchQuery({ key: ["posts"], fn: fetchPosts });
      client.subscribe(["posts"], () => {});
      client.ensureFetch({ key: ["posts"], fn: fetchPosts });

      fetchPosts.mockClear();

      client.invalidate(["users"]);

      expect(fetchPosts).not.toHaveBeenCalled();
    });
  });

  describe("setQueryData", () => {
    it("manually sets cache data", () => {
      const client = createQueryClient();

      client.setQueryData(["users"], [{ id: 1 }]);

      expect(client.getQueryData(["users"])).toEqual([{ id: 1 }]);
      expect(client.getSnapshot(["users"]).status).toBe("success");
    });

    it("notifies subscribers when data is set", () => {
      const client = createQueryClient();
      const callback = vi.fn();

      client.subscribe(["users"], callback);
      client.setQueryData(["users"], "new-data");

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("ensureFetch", () => {
    it("fetches on first call (idle state)", () => {
      const client = createQueryClient();
      const fn = vi.fn(async () => "data");

      client.ensureFetch({ key: ["test"], fn });

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("skips fetch when data is fresh (within staleTime)", async () => {
      const client = createQueryClient();
      const fn = vi.fn(async () => "data");

      await client.fetchQuery({ key: ["test"], fn });
      fn.mockClear();

      client.ensureFetch({ key: ["test"], fn, staleTime: 60_000 });

      expect(fn).not.toHaveBeenCalled();
    });

    it("refetches when data is stale", async () => {
      const client = createQueryClient();
      const fn = vi.fn(async () => "data");

      await client.fetchQuery({ key: ["test"], fn });
      fn.mockClear();

      // staleTime: 0 = 常に stale
      client.ensureFetch({ key: ["test"], fn, staleTime: 0 });

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
