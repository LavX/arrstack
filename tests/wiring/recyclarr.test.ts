import { test, expect } from "bun:test";
import { runRecyclarrSync } from "../../src/wiring/recyclarr.js";

test("runRecyclarrSync is exported and is async", () => {
  expect(typeof runRecyclarrSync).toBe("function");
  const result = runRecyclarrSync("/tmp/nonexistent-arrstack");
  expect(result instanceof Promise).toBe(true);
  result.catch(() => {});
});

test("runRecyclarrSync command includes recyclarr sync", async () => {
  const src = await Bun.file(
    new URL("../../src/wiring/recyclarr.ts", import.meta.url).pathname
  ).text();
  expect(src).toContain("recyclarr sync");
  expect(src).toContain("docker compose");
});
