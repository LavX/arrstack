import { describe, expect, test, afterEach } from "bun:test";
import { isNordVpnToken, deriveNordVpnPrivateKey } from "../../src/wiring/nordvpn";

describe("isNordVpnToken", () => {
  test("true for a 64-char hex access token", () => {
    expect(
      isNordVpnToken("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
    ).toBe(true);
  });

  test("trims surrounding whitespace before matching", () => {
    expect(
      isNordVpnToken("  0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef "),
    ).toBe(true);
  });

  test("false for a base64 WireGuard key (so power users can paste it directly)", () => {
    expect(isNordVpnToken("Tf6pAbcd1234EFGHijklMNOPqrstUVWXyz0123456JYo=")).toBe(false);
  });

  test("false for empty / short / non-hex values", () => {
    expect(isNordVpnToken("")).toBe(false);
    expect(isNordVpnToken("deadbeef")).toBe(false);
    expect(isNordVpnToken("z".repeat(64))).toBe(false);
  });
});

describe("deriveNordVpnPrivateKey", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  test("returns nordlynx_private_key from a 200 response", async () => {
    let sentAuth = "";
    globalThis.fetch = (async (_url: any, init: any) => {
      sentAuth = init?.headers?.Authorization ?? "";
      return new Response(JSON.stringify({ nordlynx_private_key: "DERIVEDKEY==" }), {
        status: 200,
      });
    }) as any;
    const key = await deriveNordVpnPrivateKey("mytoken", "http://nord.test/creds");
    expect(key).toBe("DERIVEDKEY==");
    // Basic auth is token:<TOKEN>
    expect(sentAuth).toBe("Basic " + btoa("token:mytoken"));
  });

  test("throws a token-specific, link-bearing error on 401", async () => {
    globalThis.fetch = (async () => new Response("", { status: 401 })) as any;
    await expect(deriveNordVpnPrivateKey("bad", "http://nord.test/creds")).rejects.toThrow(
      /rejected the access token/,
    );
  });

  test("throws when the response has no nordlynx_private_key", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({}), { status: 200 })) as any;
    await expect(deriveNordVpnPrivateKey("tok", "http://nord.test/creds")).rejects.toThrow(
      /nordlynx_private_key/,
    );
  });
});
