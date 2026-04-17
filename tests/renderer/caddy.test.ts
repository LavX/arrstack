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

  test("cloudflare mode issues ONE wildcard cert, not a cert per service", () => {
    const output = renderCaddyfile(services, {
      mode: "cloudflare",
      domain: "example.com",
    });
    expect(output).toContain("*.example.com {");
    // Exactly one tls block (= one cert). Per-service vhosts would produce
    // one tls block per service.
    expect(output.match(/tls \{/g)?.length ?? 0).toBe(1);
    expect(output).toContain("dns cloudflare {env.CF_API_TOKEN}");
    // Host matchers + handle blocks for each service.
    expect(output).toContain("@sonarr host sonarr.example.com");
    expect(output).toContain("reverse_proxy sonarr:8989");
    expect(output).toContain("@radarr host radarr.example.com");
    expect(output).toContain("reverse_proxy radarr:7878");
    // Unknown subdomains should 404 instead of leaking a random upstream.
    expect(output).toContain("respond 404");
  });

  test("duckdns mode issues ONE wildcard cert via duckdns DNS-01", () => {
    const output = renderCaddyfile(services, {
      mode: "duckdns",
      domain: "myhome.duckdns.org",
    });
    expect(output).toContain("*.myhome.duckdns.org {");
    expect(output.match(/tls \{/g)?.length ?? 0).toBe(1);
    expect(output).toContain("dns duckdns {env.DUCKDNS_TOKEN}");
    expect(output).toContain("@sonarr host sonarr.myhome.duckdns.org");
    expect(output).toContain("reverse_proxy sonarr:8989");
    expect(output).toContain("respond 404");
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
