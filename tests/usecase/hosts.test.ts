import { test, expect, describe } from "bun:test";
import {
  buildArrstackBlock,
  stripArrstackBlock,
  gatherArrstackNames,
} from "../../src/usecase/hosts.js";
import type { State } from "../../src/state/schema.js";

function makeState(partial: Partial<State>): State {
  return {
    schema_version: 1,
    installer_version: "0.0.0-test",
    install_dir: "/tmp/arrstack-test",
    storage_root: "/tmp/arrstack-test/data",
    extra_paths: [],
    admin: { username: "admin" },
    services_enabled: ["sonarr", "radarr"],
    gpu: { vendor: "none" },
    remote_access: { mode: "none" },
    local_dns: { enabled: false, tld: "arrstack.local", install_dnsmasq: true },
    vpn: { enabled: false },
    timezone: "UTC",
    puid: 1000,
    pgid: 1000,
    subtitle_languages: ["en"],
    api_keys: {},
    ...partial,
  };
}

describe("stripArrstackBlock", () => {
  test("returns input unchanged when no block is present", () => {
    const input = "127.0.0.1 localhost\n::1 localhost\n";
    expect(stripArrstackBlock(input)).toBe(input);
  });

  test("removes an arrstack block in the middle of the file", () => {
    const input = [
      "127.0.0.1 localhost",
      "# arrstack-begin",
      "192.168.1.10 sonarr.lavx.duckdns.org",
      "# arrstack-end",
      "::1 localhost",
      "",
    ].join("\n");
    expect(stripArrstackBlock(input)).toBe("127.0.0.1 localhost\n::1 localhost\n");
  });

  test("removes the block when it's the only content", () => {
    const input = "# arrstack-begin\n192.168.1.10 sonarr\n# arrstack-end\n";
    expect(stripArrstackBlock(input)).toBe("");
  });
});

describe("buildArrstackBlock", () => {
  test("emits one entry per name with BEGIN/END markers", () => {
    const block = buildArrstackBlock("192.168.1.10", [
      "lavx.duckdns.org",
      "sonarr.lavx.duckdns.org",
    ]);
    expect(block).toBe(
      "# arrstack-begin\n" +
        "192.168.1.10 lavx.duckdns.org\n" +
        "192.168.1.10 sonarr.lavx.duckdns.org\n" +
        "# arrstack-end\n"
    );
  });

  test("round-trips through stripArrstackBlock cleanly", () => {
    const existing = "127.0.0.1 localhost\n";
    const block = buildArrstackBlock("10.0.0.5", ["foo", "bar"]);
    const combined = existing + block;
    expect(stripArrstackBlock(combined)).toBe(existing);
  });
});

describe("gatherArrstackNames", () => {
  test("returns nothing when remote access is off and local DNS is off", () => {
    expect(gatherArrstackNames(makeState({}))).toEqual([]);
  });

  test("duckdns: includes apex domain + subdomain per service", () => {
    const names = gatherArrstackNames(
      makeState({
        remote_access: {
          mode: "duckdns",
          domain: "lavx.duckdns.org",
          token: "t",
        },
      })
    );
    expect(names).toContain("lavx.duckdns.org");
    expect(names).toContain("sonarr.lavx.duckdns.org");
    expect(names).toContain("radarr.lavx.duckdns.org");
  });

  test("local DNS adds {svc}.{tld} but no apex", () => {
    const names = gatherArrstackNames(
      makeState({
        local_dns: { enabled: true, tld: "home", install_dnsmasq: true },
      })
    );
    expect(names).toContain("sonarr.home");
    expect(names).toContain("radarr.home");
    expect(names).not.toContain("home");
  });
});
