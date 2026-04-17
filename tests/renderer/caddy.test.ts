import { describe, expect, test } from "bun:test";
import { renderCaddyfile } from "../../src/renderer/caddy";
import { getServicesByIds } from "../../src/catalog";

const services = getServicesByIds(["sonarr", "radarr", "jellyfin"]);

describe("renderCaddyfile", () => {
  test("LAN mode without local DNS emits an empty Caddyfile (direct IP access)", () => {
    const output = renderCaddyfile(services, { mode: "none" });
    expect(output).not.toContain("reverse_proxy");
    expect(output).not.toContain("tls {");
  });

  test("LAN mode WITH local DNS emits hostname vhosts on HTTP", () => {
    const output = renderCaddyfile(services, {
      mode: "none",
      localDns: { enabled: true, tld: "arrstack.local" },
    });
    expect(output).toContain("http://sonarr.arrstack.local");
    expect(output).toContain("reverse_proxy sonarr:8989");
    expect(output).not.toContain("tls {");
    expect(output).not.toContain("dns cloudflare");
  });

  test("cloudflare mode includes domain and dns challenge", () => {
    const output = renderCaddyfile(services, {
      mode: "cloudflare",
      domain: "example.com",
    });
    expect(output).toContain("sonarr.example.com");
    expect(output).toContain("dns cloudflare {env.CF_API_TOKEN}");
    expect(output).toContain("tls");
  });

  test("duckdns mode uses duckdns domain and token", () => {
    const output = renderCaddyfile(services, {
      mode: "duckdns",
      domain: "myhome.duckdns.org",
    });
    expect(output).toContain("sonarr.myhome.duckdns.org");
    expect(output).toContain("dns duckdns {env.DUCKDNS_TOKEN}");
  });

  test("duckdns mode has no CF_API_TOKEN reference", () => {
    const output = renderCaddyfile(services, {
      mode: "duckdns",
      domain: "myhome.duckdns.org",
    });
    expect(output).not.toContain("CF_API_TOKEN");
  });

  test("cloudflare mode has no DUCKDNS_TOKEN reference", () => {
    const output = renderCaddyfile(services, {
      mode: "cloudflare",
      domain: "example.com",
    });
    expect(output).not.toContain("DUCKDNS_TOKEN");
  });
});
