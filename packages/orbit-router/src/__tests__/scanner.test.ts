import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanRoutes } from "../scanner";

describe("scanRoutes", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createFile(filePath: string, content = "export default () => null") {
    const abs = path.join(tmpDir, "routes", filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }

  it("returns empty array if routes dir does not exist", async () => {
    const { routes } = await scanRoutes(tmpDir, "routes");
    expect(routes).toEqual([]);
  });

  it("scans root page", async () => {
    createFile("page.tsx");
    const { routes } = await scanRoutes(tmpDir, "routes");
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/");
  });

  it("scans nested static route", async () => {
    createFile("page.tsx");
    createFile("about/page.tsx");
    const { routes } = await scanRoutes(tmpDir, "routes");
    expect(routes.map((r) => r.path)).toContain("/about");
  });

  it("converts [param] to :param", async () => {
    createFile("users/[id]/page.tsx");
    const { routes } = await scanRoutes(tmpDir, "routes");
    expect(routes.some((r) => r.path === "/users/:id")).toBe(true);
  });

  it("sorts static routes before dynamic routes", async () => {
    createFile("users/page.tsx");
    createFile("users/[id]/page.tsx");
    const { routes } = await scanRoutes(tmpDir, "routes");
    const paths = routes.map((r) => r.path);
    expect(paths.indexOf("/users")).toBeLessThan(paths.indexOf("/users/:id"));
  });

  it("skips directories starting with _", async () => {
    createFile("_hidden/page.tsx");
    createFile("about/page.tsx");
    const { routes } = await scanRoutes(tmpDir, "routes");
    expect(routes.every((r) => !r.path.includes("hidden"))).toBe(true);
  });

  it("collects layout from current directory", async () => {
    createFile("page.tsx");
    createFile("layout.tsx", "export default ({ children }) => children");
    const { routes } = await scanRoutes(tmpDir, "routes");
    expect(routes[0].layouts).toHaveLength(1);
    expect(routes[0].layouts[0].layoutPath).toContain("layout.tsx");
  });

  it("collects nested layouts in outer-to-inner order", async () => {
    createFile("layout.tsx");
    createFile("users/layout.tsx");
    createFile("users/[id]/page.tsx");
    const { routes } = await scanRoutes(tmpDir, "routes");
    const userRoute = routes.find((r) => r.path === "/users/:id");
    expect(userRoute).toBeDefined();
    expect(userRoute!.layouts).toHaveLength(2);
    // First layout should be root, second should be users
    expect(userRoute!.layouts[0].layoutPath).toContain(path.join("routes", "layout.tsx"));
    expect(userRoute!.layouts[1].layoutPath).toContain(
      path.join("routes", "users", "layout.tsx"),
    );
  });

  it("handles .ts extension for page files", async () => {
    createFile("page.ts");
    const { routes } = await scanRoutes(tmpDir, "routes");
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/");
  });

  it("detects loading.tsx alongside page.tsx", async () => {
    createFile("users/page.tsx");
    createFile("users/loading.tsx", "export default () => 'Loading...'");
    const { routes } = await scanRoutes(tmpDir, "routes");
    const userRoute = routes.find((r) => r.path === "/users");
    expect(userRoute?.loadingPath).toContain("loading.tsx");
  });

  it("detects error.tsx alongside page.tsx", async () => {
    createFile("users/page.tsx");
    createFile("users/error.tsx", "export default () => 'Error'");
    const { routes } = await scanRoutes(tmpDir, "routes");
    const userRoute = routes.find((r) => r.path === "/users");
    expect(userRoute?.errorPath).toContain("error.tsx");
  });

  it("does not set optional paths when files are absent", async () => {
    createFile("page.tsx");
    const { routes } = await scanRoutes(tmpDir, "routes");
    expect(routes[0].loadingPath).toBeUndefined();
    expect(routes[0].errorPath).toBeUndefined();
  });

  it("detects not-found.tsx at routes root", async () => {
    createFile("page.tsx");
    createFile("not-found.tsx", "export default () => '404'");
    const { notFoundPath } = await scanRoutes(tmpDir, "routes");
    expect(notFoundPath).toContain("not-found.tsx");
  });

  it("returns undefined notFoundPath when not-found.tsx is absent", async () => {
    createFile("page.tsx");
    const { notFoundPath } = await scanRoutes(tmpDir, "routes");
    expect(notFoundPath).toBeUndefined();
  });

  it("collects error.tsx in layout directory into LayoutInfo.errorPath", async () => {
    createFile("layout.tsx");
    createFile("error.tsx", "export default () => 'Root Error'");
    createFile("users/page.tsx");
    const { routes } = await scanRoutes(tmpDir, "routes");
    const userRoute = routes.find((r) => r.path === "/users");
    expect(userRoute!.layouts).toHaveLength(1);
    expect(userRoute!.layouts[0].errorPath).toContain("error.tsx");
  });

  it("does not duplicate error.tsx when layout and page are in the same directory", async () => {
    createFile("users/layout.tsx");
    createFile("users/page.tsx");
    createFile("users/error.tsx", "export default () => 'Error'");
    const { routes } = await scanRoutes(tmpDir, "routes");
    const userRoute = routes.find((r) => r.path === "/users");
    // error.tsx は page 側（errorPath）に属する
    expect(userRoute!.errorPath).toContain("error.tsx");
    // 同ディレクトリの layout には error.tsx が入らない
    const innermostLayout = userRoute!.layouts[userRoute!.layouts.length - 1];
    expect(innermostLayout.errorPath).toBeUndefined();
  });

  it("bubbles error.tsx from parent layout when child has none", async () => {
    createFile("layout.tsx");
    createFile("error.tsx", "export default () => 'Root Error'");
    createFile("users/layout.tsx");
    // users/ には error.tsx なし
    createFile("users/[id]/page.tsx");
    const { routes } = await scanRoutes(tmpDir, "routes");
    const idRoute = routes.find((r) => r.path === "/users/:id");
    expect(idRoute!.layouts).toHaveLength(2);
    // root layout has error.tsx
    expect(idRoute!.layouts[0].errorPath).toContain("error.tsx");
    // users layout has no error.tsx
    expect(idRoute!.layouts[1].errorPath).toBeUndefined();
    // page has no error.tsx
    expect(idRoute!.errorPath).toBeUndefined();
  });
});
