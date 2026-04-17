import { describe, expect, test } from "bun:test";
import { configureQbit } from "../../src/wiring/qbittorrent";

// NEVER call configureQbit() without an explicit base URL in these tests.
// The default is http://localhost:8080 — on any developer host with an
// arrstack install running, hitting that repeatedly will exceed qBittorrent's
// failed-login threshold (5 attempts) and get the host IP banned until the
// container is restarted. The ban is shared across all future login attempts
// including the installer's own, so the *next* `arrstack install` run fails
// with "qBittorrent login failed: 403". Always point tests at an unreachable
// port so they only exercise the connection-refused path.
const UNREACHABLE = "http://127.0.0.1:19999";

describe("configureQbit", () => {
  test("is an async function", () => {
    expect(configureQbit).toBeInstanceOf(Function);
    const result = configureQbit("admin", "pass", UNREACHABLE);
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });

  test("accepts a custom base URL", () => {
    const result = configureQbit("admin", "pass", "http://127.0.0.1:19998");
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });

  test("rejects when the API is unreachable", async () => {
    await expect(configureQbit("admin", "pass", UNREACHABLE)).rejects.toThrow();
  });

  test("rejects when login is rejected", async () => {
    await expect(configureQbit("baduser", "badpass", UNREACHABLE)).rejects.toThrow();
  });
});
