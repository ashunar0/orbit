import { describe, it, expect } from "vitest";
import { matchRoute } from "../runtime/match";

describe("matchRoute", () => {
  it("matches static root path", () => {
    expect(matchRoute("/", "/")).toEqual({ params: {} });
  });

  it("matches static path", () => {
    expect(matchRoute("/about", "/about")).toEqual({ params: {} });
  });

  it("matches nested static path", () => {
    expect(matchRoute("/docs/guide", "/docs/guide")).toEqual({ params: {} });
  });

  it("returns null for non-matching static path", () => {
    expect(matchRoute("/about", "/users")).toBeNull();
  });

  it("returns null when segment count differs", () => {
    expect(matchRoute("/users/:id", "/users")).toBeNull();
    expect(matchRoute("/users", "/users/1")).toBeNull();
  });

  it("extracts single dynamic parameter", () => {
    expect(matchRoute("/users/:id", "/users/123")).toEqual({
      params: { id: "123" },
    });
  });

  it("extracts slug parameter", () => {
    expect(matchRoute("/blog/:slug", "/blog/hello-world")).toEqual({
      params: { slug: "hello-world" },
    });
  });

  it("decodes URI-encoded parameter", () => {
    expect(matchRoute("/blog/:slug", "/blog/hello%20world")).toEqual({
      params: { slug: "hello world" },
    });
  });

  it("returns null for partial mismatch with dynamic segment", () => {
    expect(matchRoute("/users/:id/posts", "/users/1/comments")).toBeNull();
  });

  it("matches root against root only", () => {
    expect(matchRoute("/", "/about")).toBeNull();
  });
});
