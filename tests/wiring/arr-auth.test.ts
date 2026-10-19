import { describe, expect, test, afterEach } from "bun:test";
import { seedArrAdmin, ARR_AUTH_TARGETS, type ArrAuthOptions } from "../../src/wiring/arr-auth";

const BASE_OPTS: ArrAuthOptions = {
  apiKey: "test-api-key",
  username: "admin",
  password: "test-password",
  baseUrl: "http://arr.test",
  apiVersion: "v3",
};

const origFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = origFetch;
});

interface RecordedCall {
  url: string;
  method: string;
  body?: any;
}

function mockHostConfig(
  current: Record<string, unknown>,
  putStatus = 200,
): RecordedCall[] {
  const calls: RecordedCall[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    calls.push({ url: u, method, body: init?.body ? JSON.parse(init.body) : undefined });
    if (method === "GET") {
      return new Response(JSON.stringify(current), { status: 200 });
    }
    return new Response(JSON.stringify({ ...current, ...JSON.parse(init.body) }), {
      status: putStatus,
    });
  }) as any;
  return calls;
}

describe("seedArrAdmin", () => {
  test("writes forms auth credentials to an unseeded instance", async () => {
    const calls = mockHostConfig({ username: "", password: null });

    await expect(seedArrAdmin(BASE_OPTS)).resolves.toBe("seeded");

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("http://arr.test/api/v3/config/host");
    expect(calls[0].method).toBe("GET");
    expect(calls[1].method).toBe("PUT");
    expect(calls[1].body.authenticationMethod).toBe("forms");
    expect(calls[1].body.authenticationRequired).toBe("enabled");
    expect(calls[1].body.username).toBe("admin");
    expect(calls[1].body.password).toBe("test-password");
    expect(calls[1].body.passwordConfirmation).toBe("test-password");
  });

  test("accepts 202 Accepted from Sonarr and Radarr", async () => {
    mockHostConfig({ username: "", password: null }, 202);
    await expect(seedArrAdmin(BASE_OPTS)).resolves.toBe("seeded");
  });

  test("does not overwrite an existing admin", async () => {
    const calls = mockHostConfig({ username: "admin", password: "existing-hash" });
    await expect(seedArrAdmin(BASE_OPTS)).resolves.toBe("exists");
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  test("does not overwrite credentials the user changed in the UI", async () => {
    // Regression guard for update-time recovery: a non-default username means
    // the user owns the account now, so the installer password must not reset it.
    const calls = mockHostConfig({ username: "bob", password: "existing-hash" });
    await expect(seedArrAdmin(BASE_OPTS)).resolves.toBe("exists");
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  test("rejects when the PUT fails", async () => {
    mockHostConfig({ username: "", password: null }, 400);
    await expect(seedArrAdmin(BASE_OPTS)).rejects.toThrow(/PUT .* failed: HTTP 400/);
  });

  test("targets are the three arr apps with their API versions", () => {
    expect(ARR_AUTH_TARGETS).toEqual([
      { id: "prowlarr", port: 9696, apiVersion: "v1" },
      { id: "sonarr", port: 8989, apiVersion: "v3" },
      { id: "radarr", port: 7878, apiVersion: "v3" },
    ]);
  });
});
