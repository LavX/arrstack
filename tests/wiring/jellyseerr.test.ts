import { test, expect } from "bun:test";
import { linkJellyseerr } from "../../src/wiring/jellyseerr.js";

test("linkJellyseerr is exported and is async", () => {
  expect(typeof linkJellyseerr).toBe("function");
  const result = linkJellyseerr("admin", "pass", "http://127.0.0.1:19999");
  expect(result instanceof Promise).toBe(true);
  result.catch(() => {});
});

interface Call {
  method: string;
  url: string;
}

function mockSeerr(
  librarySyncStatus: number,
  hostnameAlreadyConfigured = false,
): { calls: Call[]; authBodies: any[]; restore: () => void } {
  const origFetch = globalThis.fetch;
  const calls: Call[] = [];
  const authBodies: any[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    calls.push({ method, url: u });

    if (u.endsWith("/api/v1/settings/public")) {
      return new Response("{}", { status: 200 });
    }
    if (u.endsWith("/api/v1/auth/jellyfin")) {
      const body = init?.body ? JSON.parse(init.body) : {};
      authBodies.push(body);
      if (hostnameAlreadyConfigured && body.hostname) {
        return new Response(JSON.stringify({ error: "Jellyfin hostname already configured" }), {
          status: 500,
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "set-cookie": "connect.sid=test-session; Path=/; HttpOnly" },
      });
    }
    if (u.endsWith("/api/v1/settings/main")) {
      return new Response("{}", { status: 200 });
    }
    if (u.endsWith("/api/v1/settings/jellyfin/library/sync")) {
      if (librarySyncStatus !== 200) {
        return new Response("not found", { status: librarySyncStatus });
      }
      return new Response(
        JSON.stringify([
          { id: "movies", name: "Movies", enabled: false, type: "movies" },
          { id: "tv", name: "TV Shows", enabled: false, type: "tvshows" },
        ]),
        { status: 200 },
      );
    }
    if (u.includes("/api/v1/settings/jellyfin/library?sync=true")) {
      return new Response(
        JSON.stringify([{ id: "movies", name: "Movies", enabled: false, type: "movies" }]),
        { status: 200 },
      );
    }
    if (u.includes("/api/v1/settings/jellyfin/library?enable=")) {
      return new Response("{}", { status: 200 });
    }
    if (u.includes("/api/v1/settings/jellyfin/library/")) {
      return new Response("{}", { status: 200 });
    }
    if (u.endsWith("/api/v1/settings/jellyfin/sync")) {
      return new Response("{}", { status: 200 });
    }
    if (u.endsWith("/api/v1/settings/initialize")) {
      return new Response("{}", { status: 200 });
    }
    return new Response("{}", { status: 200 });
  }) as any;
  return { calls, authBodies, restore: () => { globalThis.fetch = origFetch; } };
}

test("linkJellyseerr uses the Seerr 3.x library sync and per-library enable API", async () => {
  const mock = mockSeerr(200);
  try {
    await linkJellyseerr("admin", "pw", "http://seerr.test");
  } finally {
    mock.restore();
  }

  const urls = mock.calls.map((c) => `${c.method} ${c.url}`);
  expect(urls).toContain("POST http://seerr.test/api/v1/settings/jellyfin/library/sync");
  expect(urls).toContain("PUT http://seerr.test/api/v1/settings/jellyfin/library/movies");
  expect(urls).toContain("PUT http://seerr.test/api/v1/settings/jellyfin/library/tv");
  expect(urls.some((u) => u.includes("?sync=true"))).toBe(false);
  expect(urls.some((u) => u.includes("?enable="))).toBe(false);
  expect(urls.some((u) => u.startsWith("POST ") && u.endsWith("/settings/initialize"))).toBe(true);
});

test("linkJellyseerr logs in to an existing install when the hostname is already configured", async () => {
  const mock = mockSeerr(200, true);
  try {
    await linkJellyseerr("admin", "pw", "http://seerr.test");
  } finally {
    mock.restore();
  }

  expect(mock.authBodies.length).toBeGreaterThanOrEqual(2);
  expect(mock.authBodies[0].hostname).toBe("jellyfin");
  expect(mock.authBodies[1].hostname).toBeUndefined();
});

test("linkJellyseerr falls back to the legacy library API on 404", async () => {
  const mock = mockSeerr(404);
  try {
    await linkJellyseerr("admin", "pw", "http://seerr.test");
  } finally {
    mock.restore();
  }

  const urls = mock.calls.map((c) => `${c.method} ${c.url}`);
  expect(urls).toContain("GET http://seerr.test/api/v1/settings/jellyfin/library?sync=true");
  expect(urls.some((u) => u.includes("library?enable="))).toBe(true);
});
