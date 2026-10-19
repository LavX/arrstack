import { describe, expect, test, mock, afterEach } from "bun:test";
import { configureArr } from "../../src/wiring/sonarr-radarr";

describe("configureArr", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  const optsFor = (category: "tv" | "movies") => ({
    rootFolder: category === "tv" ? "/data/media/tv" : "/data/media/movies",
    extraFolders: [],
    qbitUser: "admin",
    qbitPass: "pass",
    category,
  });

  test("is an async function", () => {
    expect(configureArr).toBeInstanceOf(Function);
    expect(configureArr.constructor.name).toBe("AsyncFunction");
  });

  test("uses port 8989 for sonarr and 7878 for radarr", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (url: any) => {
      urls.push(String(url));
      return new Response("[]", { status: 200 });
    }) as any;

    await configureArr("sonarr", "key", optsFor("tv"));
    await configureArr("radarr", "key", optsFor("movies"));

    expect(urls.some((u) => u.startsWith("http://localhost:8989/"))).toBe(true);
    expect(urls.some((u) => u.startsWith("http://localhost:7878/"))).toBe(true);
  });

  test("rejects when the request layer fails", async () => {
    globalThis.fetch = (async () => {
      throw new Error("boom");
    }) as any;
    await expect(configureArr("sonarr", "key", optsFor("tv"))).rejects.toThrow("boom");
  });
});

// Mock fetch so these never touch the network. They lock in that toggling VPN
// (host moves between "qbittorrent" and "gluetun") UPDATES the existing
// qBittorrent client in place instead of POSTing a duplicate.
describe("configureArr download client host changes (VPN toggle)", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  const optsFor = (qbitHost: string) => ({
    rootFolder: "/data/media/tv",
    extraFolders: [],
    qbitUser: "admin",
    qbitPass: "pw",
    category: "tv",
    qbitHost,
  });

  test("updates (PUT) the existing client when the host changed; never POSTs a duplicate", async () => {
    const calls: Array<{ method: string; url: string; body?: string }> = [];
    globalThis.fetch = (async (url: any, init: any) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      calls.push({ method, url: u, body: init?.body });
      if (u.endsWith("/api/v3/rootfolder"))
        return new Response(JSON.stringify([{ path: "/data/media/tv" }]), { status: 200 });
      if (u.endsWith("/api/v3/downloadclient") && method === "GET")
        return new Response(
          JSON.stringify([
            {
              id: 5,
              name: "qBittorrent",
              implementation: "QBittorrent",
              fields: [
                { name: "host", value: "qbittorrent" },
                { name: "username", value: "admin" },
                { name: "password", value: "old" },
              ],
            },
          ]),
          { status: 200 },
        );
      if (u.includes("/api/v3/downloadclient/5") && method === "PUT")
        return new Response("{}", { status: 202 });
      return new Response("{}", { status: 200 });
    }) as any;

    await configureArr("sonarr", "key", optsFor("gluetun"));

    const put = calls.find((c) => c.method === "PUT" && c.url.includes("/downloadclient/5"));
    expect(put).toBeDefined();
    expect(put!.body).toContain('"value":"gluetun"');
    expect(
      calls.some((c) => c.method === "POST" && c.url.endsWith("/api/v3/downloadclient")),
    ).toBe(false);
  });

  test("no-ops when the existing client host already matches", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    globalThis.fetch = (async (url: any, init: any) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      calls.push({ method, url: u });
      if (u.endsWith("/api/v3/rootfolder"))
        return new Response(JSON.stringify([{ path: "/data/media/tv" }]), { status: 200 });
      if (u.endsWith("/api/v3/downloadclient") && method === "GET")
        return new Response(
          JSON.stringify([
            { id: 5, name: "qBittorrent", implementation: "QBittorrent", fields: [{ name: "host", value: "gluetun" }] },
          ]),
          { status: 200 },
        );
      return new Response("{}", { status: 200 });
    }) as any;

    await configureArr("sonarr", "key", optsFor("gluetun"));
    expect(calls.some((c) => c.method === "PUT" || c.method === "POST")).toBe(false);
  });
});
