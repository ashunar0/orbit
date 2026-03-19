import { expect, test } from "vite-plus/test";
import { orbitRouter } from "../src";

test("orbitRouter returns an array of plugins", () => {
  const plugins = orbitRouter();
  expect(Array.isArray(plugins)).toBe(true);
  expect(plugins.length).toBeGreaterThan(0);
  expect(plugins[0].name).toBe("orbit-router:scan");
});
