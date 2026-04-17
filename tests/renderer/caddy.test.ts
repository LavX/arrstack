import { describe, expect, test } from "bun:test";
import { renderCaddyfile } from "../../src/renderer/caddy";
import { getServicesByIds } from "../../src/catalog";

const services = getServicesByIds(["sonarr", "radarr", "jellyfin"]);

describe("renderCaddyfile", () => {
  test("LAN mode has port blocks and no tls block", () => {
    const output = renderCaddyfile(services, { mode: "none" });
    expect(output).toContain(":8989");
    expect(output).not.toContain("tls");
    expect(output).not.toContain("dns");
  });

  test("LAN mode reverse_proxy uses service name", () => {
    const output = renderCaddyfile(services, { mode: "none" });
    expect(output).toContain("reverse_proxy sonarr:8989");
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
