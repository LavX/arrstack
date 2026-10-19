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

  test("drops depends_on edges to services that are not rendered", () => {
    // Catalog says Sonarr dependsOn Prowlarr, but the wizard lets users deselect
    // Prowlarr. A dangling edge makes `docker compose` reject the project with
    // "depends on undefined service", so it must not be emitted.
    const services = getServices(["sonarr"]);
    const ctx = buildComposeContext(services, baseOpts);
    const sonarr = ctx.services.find((s) => s.id === "sonarr")!;
    expect(sonarr.dependsOn.map((d) => d.service)).not.toContain("prowlarr");

    const output = renderCompose(services, baseOpts);
    expect(output).not.toContain("- prowlarr");
  });

  test("keeps depends_on edges when both services are rendered", () => {
    const services = getServices(["sonarr", "prowlarr"]);
    const ctx = buildComposeContext(services, baseOpts);
    const sonarr = ctx.services.find((s) => s.id === "sonarr")!;
    expect(sonarr.dependsOn.map((d) => d.service)).toContain("prowlarr");
  });

  test("logging block is present", () => {
    const services = getServices(["sonarr"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("driver: json-file");
    expect(output).toContain("max-size");
    expect(output).toContain("max-file");
  });

  test("opensubtitles-scraper is gone; bazarr no longer depends on it", () => {
    const output = renderCompose(getServices(["bazarr", "flaresolverr"]), baseOpts);
    expect(output).not.toContain("opensubtitles-scraper");
    expect(output).not.toContain("OPENSUBTITLES_SCRAPER_URL");
    const ctx = buildComposeContext(getServices(["bazarr"]), baseOpts);
    const bazarr = ctx.services.find((s) => s.id === "bazarr")!;
    expect(bazarr.dependsOn.map((d) => d.service)).not.toContain("opensubtitles-scraper");
  });

  test("arrstack network is defined", () => {
    const services = getServices(["sonarr"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("networks:");
    expect(output).toContain("arrstack:");
    expect(output).toContain("driver: bridge");
  });

  test("qbittorrent with VPN routes through gluetun and publishes no ports of its own", () => {
    const services = getServices(["gluetun", "qbittorrent"]);
    const opts = { ...baseOpts, vpn: { enabled: true, provider: "mullvad" } };
    const ctx = buildComposeContext(services, opts);
    const qbit = ctx.services.find((s) => s.id === "qbittorrent")!;
    expect(qbit.vpnNetwork).toBe(true);
    expect(qbit.ports).toEqual([]);
    expect(renderCompose(services, opts)).toContain('network_mode: "service:gluetun"');
  });

  test("VPN: gluetun publishes the routed qBittorrent WebUI port so host/LAN can reach it", () => {
    // qBittorrent has no IP of its own inside gluetun's netns; the 8080 WebUI
    // port must be published BY gluetun or the WebUI (and the installer's health
    // gate on localhost:8080) is unreachable. This was the "did not become
    // healthy within 180s" bug.
    const services = getServices(["gluetun", "qbittorrent"]);
    const opts = { ...baseOpts, vpn: { enabled: true, provider: "mullvad" } };
    const ctx = buildComposeContext(services, opts);
    const glue = ctx.services.find((s) => s.id === "gluetun")!;
    expect(glue.ports).toContainEqual({ binding: "0.0.0.0:8080:8080" });
    expect(renderCompose(services, opts)).toContain("0.0.0.0:8080:8080");
  });

  test("VPN: qBittorrent depends on a HEALTHY gluetun (kills the netns race)", () => {
    const services = getServices(["gluetun", "qbittorrent"]);
    const opts = { ...baseOpts, vpn: { enabled: true, provider: "mullvad" } };
    const ctx = buildComposeContext(services, opts);
    const qbit = ctx.services.find((s) => s.id === "qbittorrent")!;
    expect(qbit.dependsOn).toContainEqual({
      service: "gluetun",
      condition: "service_healthy",
    });
    expect(renderCompose(services, opts)).toContain("condition: service_healthy");
  });

  test("VPN: gluetun gets a compose-level healthcheck so service_healthy can resolve", () => {
    const services = getServices(["gluetun", "qbittorrent"]);
    const opts = { ...baseOpts, vpn: { enabled: true, provider: "mullvad" } };
    const ctx = buildComposeContext(services, opts);
    const glue = ctx.services.find((s) => s.id === "gluetun")!;
    expect(glue.healthcheck).toBeDefined();
    const output = renderCompose(services, opts);
    expect(output).toContain("healthcheck:");
    expect(output).toContain("/gluetun-entrypoint");
    expect(output).toContain("start_period:");
  });

  test("VPN off: qBittorrent publishes its own 8080 and has no gluetun dependency", () => {
    const services = getServices(["qbittorrent"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("0.0.0.0:8080:8080");
    expect(output).not.toContain("service:gluetun");
  });

  test("gluetun nordvpn provider emits provider env, no custom endpoint tuple", () => {
    const services = getServices(["gluetun"]);
    const output = renderCompose(services, {
      ...baseOpts,
      vpn: {
        enabled: true,
        provider: "nordvpn",
        type: "wireguard",
        private_key: "NORDKEY==",
        countries: "Netherlands",
      },
    });
    expect(output).toContain("VPN_SERVICE_PROVIDER=nordvpn");
    expect(output).toContain("VPN_TYPE=wireguard");
    expect(output).toContain("WIREGUARD_PRIVATE_KEY=NORDKEY==");
    expect(output).toContain("SERVER_COUNTRIES=Netherlands");
    expect(output).not.toContain("VPN_ENDPOINT_IP");
    expect(output).not.toContain("WIREGUARD_PUBLIC_KEY");
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

  test("even with a remote-access mode, admin ports still bind 0.0.0.0 for LAN direct access", () => {
    // Whether a port is reachable from the public internet is governed by
    // the user's router port-forwards, not by the bindHost. Binding 0.0.0.0
    // gives LAN clients http://{hostIp}:{port} access in every mode; Caddy
    // remains the only service the user would forward to the internet.
    const services = getServices(["sonarr"]);
    const output = renderCompose(services, { ...baseOpts, remoteMode: "cloudflare" });
    expect(output).toContain("0.0.0.0:8989:8989");
    expect(output).not.toContain("127.0.0.1:8989:8989");
  });

  test("caddy ports are bound to 0.0.0.0 so the reverse proxy is reachable", () => {
    const services = getServices(["caddy"]);
    const output = renderCompose(services, baseOpts);
    expect(output).toContain("0.0.0.0:80:80");
    expect(output).toContain("0.0.0.0:443:443");
  });

  test("caddy mounts the rendered Caddyfile read-only into /etc/caddy/Caddyfile", () => {
    // Without this mount Caddy starts with its built-in default site and
    // serves the "Caddy works!" welcome page for every vhost the user
    // configured.
    const services = getServices(["caddy"]);
    const output = renderCompose(services, {
      ...baseOpts,
      installDir: "/home/lavx/arrstack",
    });
    expect(output).toContain(
      "/home/lavx/arrstack/Caddyfile:/etc/caddy/Caddyfile:ro"
    );
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

  test("gluetun emits WireGuard env vars when vpn.enabled with mullvad", () => {
    const services = getServices(["gluetun"]);
    const output = renderCompose(services, {
      ...baseOpts,
      vpn: {
        enabled: true,
        provider: "mullvad",
        type: "wireguard",
        private_key: "TESTKEY==",
        addresses: "10.64.222.21/32",
        countries: "Switzerland",
      },
    });
    expect(output).toContain("VPN_SERVICE_PROVIDER=mullvad");
    expect(output).toContain("VPN_TYPE=wireguard");
    expect(output).toContain("WIREGUARD_PRIVATE_KEY=TESTKEY==");
    expect(output).toContain("WIREGUARD_ADDRESSES=10.64.222.21/32");
    expect(output).toContain("SERVER_COUNTRIES=Switzerland");
  });

  test("gluetun custom provider emits endpoint + server pubkey", () => {
    const services = getServices(["gluetun"]);
    const output = renderCompose(services, {
      ...baseOpts,
      vpn: {
        enabled: true,
        provider: "custom",
        type: "wireguard",
        private_key: "K",
        addresses: "10.0.0.1/32",
        endpoint_ip: "203.0.113.7",
        endpoint_port: 51820,
        server_public_key: "PUB=",
      },
    });
    expect(output).toContain("VPN_SERVICE_PROVIDER=custom");
    expect(output).toContain("VPN_ENDPOINT_IP=203.0.113.7");
    expect(output).toContain("VPN_ENDPOINT_PORT=51820");
    expect(output).toContain("WIREGUARD_PUBLIC_KEY=PUB=");
  });

  test("gluetun emits no VPN env vars when vpn.enabled is false", () => {
    const services = getServices(["gluetun"]);
    const output = renderCompose(services, baseOpts);
    expect(output).not.toContain("VPN_SERVICE_PROVIDER");
    expect(output).not.toContain("WIREGUARD_PRIVATE_KEY");
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

describe("healthchecks + deunhealth reboot self-heal", () => {
  test("http services get a curl-or-wget healthcheck from the catalog", () => {
    const ctx = buildComposeContext(getServices(["sonarr"]), baseOpts);
    const sonarr = ctx.services.find((s) => s.id === "sonarr")!;
    expect(sonarr.healthcheck).toBeDefined();
    // Portable probe: some arr/media images ship only curl, some only wget.
    expect(sonarr.healthcheck!.test).toContain("curl -fsS");
    expect(sonarr.healthcheck!.test).toContain("wget -q");
    expect(sonarr.healthcheck!.test).toContain("http://127.0.0.1:8989/ping");
  });

  test("non-VPN qBittorrent uses the loopback WebUI probe", () => {
    const ctx = buildComposeContext(getServices(["qbittorrent"]), baseOpts);
    const qbit = ctx.services.find((s) => s.id === "qbittorrent")!;
    expect(qbit.healthcheck).toBeDefined();
    expect(qbit.healthcheck!.test).toContain("http://127.0.0.1:8080/");
  });

  test("VPN-routed qBittorrent probes BOTH gluetun's control server and its own WebUI", () => {
    // Leg 1 (control server, 8000) catches the reboot orphaned-netns case: a bare
    // loopback WebUI probe would stay 'healthy' when orphaned (qbit's own 8080
    // still answers), and it holds during a real tunnel outage. Leg 2 (WebUI,
    // 8080) catches a hung qbit while gluetun is up. Both must pass to be healthy.
    const opts = { ...baseOpts, vpn: { enabled: true, provider: "mullvad" } };
    const ctx = buildComposeContext(getServices(["gluetun", "qbittorrent"]), opts);
    const qbit = ctx.services.find((s) => s.id === "qbittorrent")!;
    expect(qbit.healthcheck).toBeDefined();
    expect(qbit.healthcheck!.test).toContain("127.0.0.1:8000");
    expect(qbit.healthcheck!.test).toContain("127.0.0.1:8080");
    expect(qbit.healthcheck!.test).toContain("&&"); // both legs required
  });

  test("tcp/port-0 catalog health blocks are NOT rendered (caddy, recyclarr)", () => {
    const ctx = buildComposeContext(getServices(["caddy", "recyclarr"]), baseOpts);
    expect(ctx.services.find((s) => s.id === "caddy")!.healthcheck).toBeUndefined();
    expect(ctx.services.find((s) => s.id === "recyclarr")!.healthcheck).toBeUndefined();
  });

  test("VPN on: qBittorrent is labeled for deunhealth auto-restart", () => {
    const opts = { ...baseOpts, vpn: { enabled: true, provider: "mullvad" } };
    const ctx = buildComposeContext(getServices(["gluetun", "qbittorrent", "deunhealth"]), opts);
    const qbit = ctx.services.find((s) => s.id === "qbittorrent")!;
    expect(qbit.labels).toContain("deunhealth.restart.on.unhealthy=true");
    expect(renderCompose(getServices(["gluetun", "qbittorrent", "deunhealth"]), opts)).toContain(
      "deunhealth.restart.on.unhealthy=true",
    );
  });

  test("VPN off: qBittorrent carries no deunhealth label (nothing to auto-restart)", () => {
    const ctx = buildComposeContext(getServices(["qbittorrent"]), baseOpts);
    const qbit = ctx.services.find((s) => s.id === "qbittorrent")!;
    expect(qbit.labels).not.toContain("deunhealth.restart.on.unhealthy=true");
  });

  test("deunhealth gets the docker socket (read-only) so it can restart containers", () => {
    const ctx = buildComposeContext(getServices(["deunhealth"]), baseOpts);
    const dh = ctx.services.find((s) => s.id === "deunhealth")!;
    expect(dh.dataMounts).toContainEqual({
      src: "/var/run/docker.sock",
      dst: "/var/run/docker.sock",
      mode: "ro",
    });
    // No other service should be handed the daemon socket.
    const sonarr = buildComposeContext(getServices(["sonarr"]), baseOpts).services[0];
    expect(sonarr.dataMounts.some((m) => m.src.includes("docker.sock"))).toBe(false);
  });

  test("VPN stack renders the full reboot-recovery trio together (sidecar + label + socket)", () => {
    // All three must co-render or the self-heal is a no-op: the deunhealth
    // watcher, the label that arms it on qbit, and the socket that lets it
    // actually restart qbit. This fails if any leg of the v1.1.1 change regresses.
    const ids = ["gluetun", "qbittorrent", "deunhealth"];
    const opts = { ...baseOpts, vpn: { enabled: true, provider: "mullvad" } };
    const output = renderCompose(getServices(ids), opts);
    expect(output).toContain("deunhealth:");
    expect(output).toContain("deunhealth.restart.on.unhealthy=true");
    expect(output).toContain("/var/run/docker.sock:/var/run/docker.sock:ro");
  });
});
