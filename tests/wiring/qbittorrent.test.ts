import { describe, expect, test, afterEach } from "bun:test";
import { configureQbit } from "../../src/wiring/qbittorrent";

// NEVER call configureQbit() against the default localhost:8080 in these
// tests. On any developer host with an arrstack install running, repeated
// failed logins exceed qBittorrent's threshold and ban the host IP until the
// container restarts. Every test here mocks fetch or supplies a fake base URL.
describe("configureQbit", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  test("is an async function", () => {
    expect(configureQbit).toBeInstanceOf(Function);
    expect(configureQbit.constructor.name).toBe("AsyncFunction");
  });

  test("rejects when the request layer fails", async () => {
    globalThis.fetch = (async () => {
      throw new Error("boom");
    }) as any;
    await expect(configureQbit("admin", "pass", "http://qbit.test")).rejects.toThrow("boom");
  });

  test("rejects when login is rejected", async () => {
    globalThis.fetch = (async () => new Response("Forbidden", { status: 403 })) as any;
    await expect(configureQbit("baduser", "badpass", "http://qbit.test")).rejects.toThrow(
      /login failed: 403/,
    );
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

  test("sends enable_os_cache:false to bound libtorrent-2.0 RAM growth", async () => {
    let prefsJson: any = null;
    globalThis.fetch = (async (url: any, init: any) => {
      const u = String(url);
      if (u.endsWith("/auth/login")) {
        return new Response("", {
          status: 204,
          headers: { "set-cookie": "QBT_SID_8080=c; path=/" },
        });
      }
      if (u.includes("setPreferences")) {
        const body = new URLSearchParams(String(init?.body));
        prefsJson = JSON.parse(body.get("json") ?? "{}");
      }
      return new Response("Ok.", { status: 200 });
    }) as any;
    await configureQbit("admin", "pw", "http://qbit.test");
    expect(prefsJson).not.toBeNull();
    expect(prefsJson.enable_os_cache).toBe(false);
  });
});
