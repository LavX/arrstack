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

test("setupJellyfin skips Startup/User when a previous attempt created the user", async () => {
  const origFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${u}`);
    if (u.endsWith("/System/Info/Public")) {
      return new Response(JSON.stringify({ StartupWizardCompleted: false }), { status: 200 });
    }
    if (u.endsWith("/Startup/User") && method === "GET") {
      return new Response(JSON.stringify({ Name: "admin" }), { status: 200 });
    }
    if (u.endsWith("/Startup/User") && method === "POST") {
      return new Response("first user exists", { status: 403 });
    }
    if (u.endsWith("/Users/AuthenticateByName")) {
      return new Response(
        JSON.stringify({
          AccessToken: "tok-123",
          User: { Id: "user-1", Policy: { IsAdministrator: true } },
        }),
        { status: 200 },
      );
    }
    if (u.endsWith("/Library/VirtualFolders") && method === "GET") {
      return new Response("[]", { status: 200 });
    }
    return new Response("{}", { status: 200 });
  }) as any;

  try {
    await setupJellyfin("admin", "pw", [], "http://jellyfin.test");
  } finally {
    globalThis.fetch = origFetch;
  }

  expect(calls).not.toContain("POST http://jellyfin.test/Startup/User");
  expect(calls).toContain("POST http://jellyfin.test/Startup/Complete");
});

// Jellyfin 12.x disables legacy X-Emby-Authorization by default. The standard
// Authorization header carries Client/Device/DeviceId/Version, which
// AuthenticateByName requires for request.App.
test("setupJellyfin uses the standard Authorization header", async () => {
  const origFetch = globalThis.fetch;
  const authHeaders: Record<string, string>[] = [];
  const libraryHeaders: Record<string, string>[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const u = String(url);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (u.endsWith("/System/Info/Public")) {
      return new Response(JSON.stringify({ StartupWizardCompleted: true }), { status: 200 });
    }
    if (u.endsWith("/Users/AuthenticateByName")) {
      authHeaders.push(headers);
      return new Response(
        JSON.stringify({
          AccessToken: "tok-123",
          User: { Id: "user-1", Policy: { IsAdministrator: true } },
        }),
        { status: 200 },
      );
    }
    if (u.includes("/Library/VirtualFolders")) {
      libraryHeaders.push(headers);
      return new Response("[]", { status: 200 });
    }
    return new Response("{}", { status: 200 });
  }) as any;

  try {
    await setupJellyfin(
      "admin",
      "pw",
      [{ name: "Movies", type: "movies", paths: ["/data/media/movies"] }],
      "http://jellyfin.test",
    );
  } finally {
    globalThis.fetch = origFetch;
  }

  expect(authHeaders).toHaveLength(1);
  expect(authHeaders[0].Authorization).toStartWith("MediaBrowser ");
  expect(authHeaders[0].Authorization).toContain('Client="arrstack"');
  expect(authHeaders[0]["X-Emby-Authorization"]).toBe(authHeaders[0].Authorization);

  expect(libraryHeaders.length).toBeGreaterThan(0);
  expect(libraryHeaders[0].Authorization).toContain('Token="tok-123"');
  expect(libraryHeaders[0]["X-Emby-Authorization"]).toBe(libraryHeaders[0].Authorization);
});
