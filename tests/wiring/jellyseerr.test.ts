import { test, expect } from "bun:test";
import { linkJellyseerr } from "../../src/wiring/jellyseerr.js";

test("linkJellyseerr is exported and is async", () => {
  expect(typeof linkJellyseerr).toBe("function");
  const result = linkJellyseerr("admin", "pass", "http://127.0.0.1:19999");
  expect(result instanceof Promise).toBe(true);
  result.catch(() => {});
});
