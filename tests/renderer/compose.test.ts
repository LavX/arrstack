import { describe, expect, test } from "bun:test";
import { renderCompose, buildComposeContext } from "../../src/renderer/compose";
import { getService, getServicesByIds } from "../../src/catalog";

const baseOpts = {
  storageRoot: "/mnt/storage",
  extraPaths: [],
  puid: 1000,
  pgid: 1000,
  timezone: "America/New_York",
  apiKeys: {
    sonarr: "abc123",
    radarr: "def456",
    prowlarr: "ghi789",
  },
  gpu: { vendor: "none" as const },
  vpn: { enabled: false },
};

function getServices(ids: string[]) {
  return getServicesByIds(ids);
}

describe("renderCompose", () => {
  test("sonarr service appears with port 8989", () => {
    const services = getServices(["sonarr"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("sonarr");
    expect(output).toContain("8989:8989");
  });

  test("logging block is present", () => {
    const services = getServices(["sonarr"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("driver: json-file");
    expect(output).toContain("max-size");
    expect(output).toContain("max-file");
  });

  test("arrstack network is defined", () => {
    const services = getServices(["sonarr"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("networks:");
    expect(output).toContain("arrstack:");
    expect(output).toContain("driver: bridge");
  });

  test("qbittorrent with VPN uses service network mode and no ports", () => {
    const services = getServices(["gluetun", "qbittorrent"]);
    const opts = { ...baseOpts, vpn: { enabled: true, provider: "mullvad" } };
    const output = renderCompose(services, opts);
    expect(output).toContain('network_mode: "service:gluetun"');
    expect(output).not.toContain("8080:8080");
  });

  test("PUID and PGID are in environment", () => {
    const services = getServices(["sonarr"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("PUID=1000");
    expect(output).toContain("PGID=1000");
  });

  test("API key env var is rendered for sonarr", () => {
    const services = getServices(["sonarr"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("SONARR__AUTH__APIKEY=abc123");
  });

  test("storage root path is used for config volumes", () => {
    const services = getServices(["sonarr"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("/mnt/storage/config/sonarr");
  });

  test("GPU devices added for jellyfin with Intel GPU", () => {
    const services = getServices(["jellyfin"]);
    const opts = {
      ...baseOpts,
      gpu: { vendor: "intel" as const, render_gid: 105, video_gid: 44 },
    };
    const output = renderCompose(services, opts);
    expect(output).toContain("/dev/dri/renderD128");
    expect(output).toContain("105");
    expect(output).toContain("44");
  });
});
