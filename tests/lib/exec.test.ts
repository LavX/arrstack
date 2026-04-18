import { test, expect } from "bun:test";
import { exec } from "../../src/lib/exec.js";

test("exec echo hello returns ok with stdout", async () => {
  const result = await exec("echo hello");
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.stdout).toBe("hello");
  }
});

test("exec false returns ok: false", async () => {
  const result = await exec("false");
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).not.toBe(0);
  }
});

test("exec sleep with short timeout returns ok: false with timed out in stderr", async () => {
  const result = await exec("sleep 10", { timeoutMs: 500 });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.stderr).toContain("timed out");
  }
}, 15000);
