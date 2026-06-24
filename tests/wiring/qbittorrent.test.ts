import { describe, expect, test, afterEach } from "bun:test";
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

// These mock fetch entirely, so they never touch the network (no ban risk) and
// lock in qBittorrent 5.x's login contract: 204 No Content + a QBT_SID_<port>
// cookie on success, 200 "Fails." on bad credentials.
describe("configureQbit login handling (qBittorrent 5.x)", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  test("accepts a 204 login with a QBT_SID_<port> cookie and wires categories/prefs", async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (url: any) => {
      const u = String(url);
      calls.push(u);
      if (u.endsWith("/auth/login")) {
        return new Response("", {
          status: 204,
          headers: { "set-cookie": "QBT_SID_8080=sessioncookie; HttpOnly; SameSite=Lax; path=/" },
        });
      }
      return new Response("Ok.", { status: 200 });
    }) as any;
    await expect(configureQbit("admin", "pw", "http://qbit.test")).resolves.toBeUndefined();
    expect(calls.some((c) => c.includes("createCategory"))).toBe(true);
    expect(calls.some((c) => c.includes("setPreferences"))).toBe(true);
  });

  test("rejects on bad credentials (200 'Fails.')", async () => {
    globalThis.fetch = (async () => new Response("Fails.", { status: 200 })) as any;
    await expect(configureQbit("admin", "wrong", "http://qbit.test")).rejects.toThrow(
      /incorrect username or password/,
    );
  });
});
