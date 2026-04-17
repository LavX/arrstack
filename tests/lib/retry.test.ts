import { test, expect } from "bun:test";
import { withRetry, fetchWithRetry } from "../../src/lib/retry.js";

test("withRetry returns value on first success", async () => {
  const result = await withRetry(async () => 42);
  expect(result).toBe(42);
});

test("withRetry retries on ECONNREFUSED-style errors", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error("fetch failed: ECONNREFUSED 127.0.0.1");
      return "ok";
    },
    { baseMs: 1, attempts: 5 },
  );
  expect(result).toBe("ok");
  expect(calls).toBe(3);
});

test("withRetry does not retry on non-transient errors", async () => {
  let calls = 0;
  await expect(
    withRetry(
      async () => {
        calls++;
        throw new Error("bad payload: 422");
      },
      { baseMs: 1, attempts: 5 },
    ),
  ).rejects.toThrow();
  expect(calls).toBe(1);
});

test("withRetry throws after exhausting attempts", async () => {
  let calls = 0;
  await expect(
    withRetry(
      async () => {
        calls++;
        throw new Error("fetch failed");
      },
      { baseMs: 1, attempts: 3 },
    ),
  ).rejects.toThrow();
  expect(calls).toBe(3);
});

test("fetchWithRetry export exists", () => {
  expect(typeof fetchWithRetry).toBe("function");
});
