import { test, expect } from "bun:test";
import { setupJellyfin } from "../../src/wiring/jellyfin.js";

test("setupJellyfin is exported and is async", () => {
  expect(typeof setupJellyfin).toBe("function");
  // Calling with an unreachable host should return a rejected promise, confirming async
  const result = setupJellyfin("admin", "pass", [], "http://127.0.0.1:19999");
  expect(result instanceof Promise).toBe(true);
  // Suppress unhandled rejection
  result.catch(() => {});
});
