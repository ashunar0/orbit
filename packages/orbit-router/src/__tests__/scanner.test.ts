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
    const routes = await scanRoutes(tmpDir, "routes");
    expect(routes).toEqual([]);
  });

  it("scans root page", async () => {
    createFile("page.tsx");
    const routes = await scanRoutes(tmpDir, "routes");
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/");
  });

  it("scans nested static route", async () => {
    createFile("page.tsx");
    createFile("about/page.tsx");
    const routes = await scanRoutes(tmpDir, "routes");
    expect(routes.map((r) => r.path)).toContain("/about");
  });

  it("converts [param] to :param", async () => {
    createFile("users/[id]/page.tsx");
    const routes = await scanRoutes(tmpDir, "routes");
    expect(routes.some((r) => r.path === "/users/:id")).toBe(true);
  });

  it("sorts static routes before dynamic routes", async () => {
    createFile("users/page.tsx");
    createFile("users/[id]/page.tsx");
    const routes = await scanRoutes(tmpDir, "routes");
    const paths = routes.map((r) => r.path);
    expect(paths.indexOf("/users")).toBeLessThan(paths.indexOf("/users/:id"));
  });

  it("skips directories starting with _", async () => {
    createFile("_hidden/page.tsx");
    createFile("about/page.tsx");
    const routes = await scanRoutes(tmpDir, "routes");
    expect(routes.every((r) => !r.path.includes("hidden"))).toBe(true);
  });

  it("collects layout from current directory", async () => {
    createFile("page.tsx");
    createFile("layout.tsx", "export default ({ children }) => children");
    const routes = await scanRoutes(tmpDir, "routes");
    expect(routes[0].layouts).toHaveLength(1);
    expect(routes[0].layouts[0]).toContain("layout.tsx");
  });

  it("collects nested layouts in outer-to-inner order", async () => {
    createFile("layout.tsx");
    createFile("users/layout.tsx");
    createFile("users/[id]/page.tsx");
    const routes = await scanRoutes(tmpDir, "routes");
    const userRoute = routes.find((r) => r.path === "/users/:id");
    expect(userRoute).toBeDefined();
    expect(userRoute!.layouts).toHaveLength(2);
    // First layout should be root, second should be users
    expect(userRoute!.layouts[0]).toContain(path.join("routes", "layout.tsx"));
    expect(userRoute!.layouts[1]).toContain(
      path.join("routes", "users", "layout.tsx"),
    );
  });

  it("handles .ts extension for page files", async () => {
    createFile("page.ts");
    const routes = await scanRoutes(tmpDir, "routes");
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/");
  });
});
