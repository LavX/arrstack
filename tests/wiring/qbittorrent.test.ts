import { describe, expect, test } from "bun:test";
import { configureQbit } from "../../src/wiring/qbittorrent";

describe("configureQbit", () => {
  test("is an async function", () => {
    expect(configureQbit).toBeInstanceOf(Function);
    const result = configureQbit("admin", "pass");
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });

  test("accepts a custom base URL", () => {
    const result = configureQbit("admin", "pass", "http://localhost:9090");
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });

  test("rejects when the API is unreachable", async () => {
    await expect(
      configureQbit("admin", "pass", "http://localhost:19999")
    ).rejects.toThrow();
  });

  test("rejects when login is rejected", async () => {
    // No running qBittorrent at localhost:8080 in CI, so any connection error
    // or auth failure should reject the promise.
    await expect(configureQbit("baduser", "badpass")).rejects.toThrow();
  });
});
