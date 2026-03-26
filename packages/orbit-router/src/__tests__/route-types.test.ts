import { describe, it, expect } from "vitest"
import { extractParams, generateRouteTypesContent } from "../plugin"
import type { RouteEntry } from "../scanner"

describe("extractParams", () => {
  it("returns empty array for static path", () => {
    expect(extractParams("/")).toEqual([])
    expect(extractParams("/about")).toEqual([])
    expect(extractParams("/docs/guide")).toEqual([])
  })

  it("extracts single param", () => {
    expect(extractParams("/users/:id")).toEqual(["id"])
    expect(extractParams("/blog/:slug")).toEqual(["slug"])
  })

  it("extracts multiple params", () => {
    expect(extractParams("/users/:id/posts/:postId")).toEqual(["id", "postId"])
  })
})

describe("generateRouteTypesContent", () => {
  const makeRoute = (path: string): RouteEntry => ({
    path,
    filePath: `/fake/routes${path === "/" ? "" : path}/page.tsx`,
    layouts: [],
  })

  it("generates RoutePaths union type", () => {
    const routes = [makeRoute("/"), makeRoute("/about"), makeRoute("/users/:id")]
    const content = generateRouteTypesContent(routes)

    expect(content).toContain('| "/"')
    expect(content).toContain('| "/about"')
    expect(content).toContain('| "/users/:id"')
  })

  it("generates RouteParams with correct param types", () => {
    const routes = [makeRoute("/"), makeRoute("/users/:id"), makeRoute("/blog/:slug")]
    const content = generateRouteTypesContent(routes)

    expect(content).toContain('"/": Record<string, never>;')
    expect(content).toContain('"/users/:id": { id: string };')
    expect(content).toContain('"/blog/:slug": { slug: string };')
  })

  it("generates multiple params for nested dynamic routes", () => {
    const routes = [makeRoute("/users/:userId/posts/:postId")]
    const content = generateRouteTypesContent(routes)

    expect(content).toContain('"/users/:userId/posts/:postId": { userId: string; postId: string };')
  })

  it("generates declare module for Register", () => {
    const routes = [makeRoute("/")]
    const content = generateRouteTypesContent(routes)

    expect(content).toContain('declare module "orbit-router"')
    expect(content).toContain("interface Register")
    expect(content).toContain("routePaths: RoutePaths")
    expect(content).toContain("routeParams: RouteParams")
  })

  it("generates never for empty routes", () => {
    const content = generateRouteTypesContent([])

    expect(content).toContain("export type RoutePaths =\n  never;")
  })
})
