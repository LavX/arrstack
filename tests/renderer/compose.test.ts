import { describe, expect, test } from "bun:test";
import { renderCompose, buildComposeContext } from "../../src/renderer/compose";
import { getService, getServicesByIds } from "../../src/catalog";

const baseOpts = {
  installDir: "/home/user/arrstack",
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
  remoteMode: "none" as const,
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

  test("install dir is used for config volumes", () => {
    const services = getServices(["sonarr"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("/home/user/arrstack/config/sonarr");
  });

  test("in LAN mode every admin port is bound to 0.0.0.0 for host-ip access", () => {
    const services = getServices(["sonarr"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("0.0.0.0:8989:8989");
  });

  test("with a remote-access mode, admin ports fall back to loopback behind Caddy", () => {
    const services = getServices(["sonarr"]);
    const output = renderCompose(services, { ...baseOpts, remoteMode: "cloudflare" });
    expect(output).toContain("127.0.0.1:8989:8989");
  });

  test("caddy ports are bound to 0.0.0.0 so the reverse proxy is reachable", () => {
    const services = getServices(["caddy"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("0.0.0.0:80:80");
    expect(output).toContain("0.0.0.0:443:443");
  });

  test("extra scan paths are mounted at /data/extra-N inside media containers", () => {
    const services = getServices(["sonarr", "jellyfin"]);
    const opts = { ...baseOpts, extraPaths: ["/mnt/hdd2", "/mnt/ssd1"] };
    const output = renderCompose(services, opts);
    expect(output).toContain("/mnt/hdd2:/data/extra-0");
    expect(output).toContain("/mnt/ssd1:/data/extra-1");
  });

  test("extras are NOT mounted into services without a /data role", () => {
    const services = getServices(["caddy"]);
    const opts = { ...baseOpts, extraPaths: ["/mnt/hdd2"] };
    const output = renderCompose(services, opts);
    expect(output).not.toContain("/mnt/hdd2");
  });

  test("sonarr, radarr, qbittorrent and jellyfin all share storageRoot:/data", () => {
    const services = getServices(["sonarr", "radarr", "qbittorrent", "jellyfin"]);
    const output = renderCompose(services, baseOpts);
    // TRaSH layout: every service sees the same /data root so hardlinks work
    // across Sonarr/Radarr downloads (/data/torrents/*) and media (/data/media/*).
    const dataMountCount = output.match(/- \/mnt\/storage:\/data$/gm)?.length ?? 0;
    expect(dataMountCount).toBe(4);
  });

  test("gluetun gets NET_ADMIN + /dev/net/tun so its nftables kill-switch can init", () => {
    const services = getServices(["gluetun"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("cap_add:");
    expect(output).toContain("- NET_ADMIN");
    expect(output).toContain("/dev/net/tun:/dev/net/tun");
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
