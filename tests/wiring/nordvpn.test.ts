import { describe, expect, test, afterEach } from "bun:test";
import {
  isNordVpnToken,
  deriveNordVpnPrivateKey,
  resolveVpnWireguardKey,
} from "../../src/wiring/nordvpn";

const A_TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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

describe("resolveVpnWireguardKey", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  test("derives the WG key for a NordVPN token (used by install AND update)", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ nordlynx_private_key: "WGKEY==" }), { status: 200 })) as any;
    const out = await resolveVpnWireguardKey({
      enabled: true,
      provider: "nordvpn",
      private_key: A_TOKEN,
    });
    expect(out.private_key).toBe("WGKEY==");
  });

  test("leaves an already-extracted WG key untouched (no API call)", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as any;
    const vpn = { enabled: true, provider: "nordvpn", private_key: "AlreadyAWgKeyNot64Hex=" };
    const out = await resolveVpnWireguardKey(vpn);
    expect(out.private_key).toBe(vpn.private_key);
    expect(called).toBe(false);
  });

  test("leaves non-nordvpn providers unchanged", async () => {
    const vpn = { enabled: true, provider: "mullvad", private_key: A_TOKEN };
    expect(await resolveVpnWireguardKey(vpn)).toEqual(vpn);
  });
});
