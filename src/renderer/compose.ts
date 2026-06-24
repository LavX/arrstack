import type { Service } from "../catalog/schema.js";
import { renderFile } from "./engine.js";

export interface ComposeOptions {
  installDir: string;
  storageRoot: string;
  extraPaths: string[];
  puid: number;
  pgid: number;
  timezone: string;
  apiKeys: Record<string, string>;
  gpu: {
    vendor: "intel" | "amd" | "nvidia" | "none";
    device_name?: string;
    render_gid?: number;
    video_gid?: number;
  };
  vpn: {
    enabled: boolean;
    provider?: string;
    type?: "wireguard" | "openvpn";
    private_key?: string;
    addresses?: string;
    countries?: string;
    endpoint_ip?: string;
    endpoint_port?: number;
    server_public_key?: string;
  };
  // LAN-only when "none"; reverse-proxy-fronted otherwise. Controls whether
  // admin ports bind to 0.0.0.0 (LAN) or 127.0.0.1 (behind Caddy).
  remoteMode: "none" | "duckdns" | "cloudflare";
}

interface DataMount {
  src: string;
  dst: string;
  // Bind mode. Only set for volumes that should be read-only inside the
  // container (e.g. Caddyfile). Omitted = default rw.
  mode?: "ro";
}

interface EnvEntry {
  key: string;
  value: string;
}

interface PortBinding {
  binding: string; // e.g. "127.0.0.1:8989:8989" or "0.0.0.0:443:443"
}

// A depends_on edge. `condition` upgrades it to compose long-form
// (`gluetun: { condition: service_healthy }`); without it the template emits
// the short-form list entry (`- gluetun`).
interface DependsOnEntry {
  service: string;
  condition?: string;
}

interface Healthcheck {
  test: string;
  interval: string;
  timeout: string;
  retries: number;
  start_period: string;
}

interface ServiceContext {
  id: string;
  image: string;
  tag: string;
  build?: { context: string; dockerfile: string };
  configPath: string;
  ports: PortBinding[];
  apiKeyEnv: string | undefined;
  apiKey: string | undefined;
  extraEnv: EnvEntry[];
  dataMounts: DataMount[];
  devices: string[];
  capAdd: string[];
  groupAdd: string[];
  dependsOn: DependsOnEntry[];
  // When any dependsOn entry carries a condition, the whole block must be
  // rendered in compose long-form (a map of service -> {condition}); the two
  // forms can't be mixed on one service.
  dependsOnLongForm: boolean;
  healthcheck?: Healthcheck;
  vpnNetwork: boolean;
}

// All services bind to 0.0.0.0 in every mode. On the LAN, users can always
// reach services via both http://{hostIp}:{port} AND (if enabled) the local
// DNS vhost http://{svc}.{tld}. In duckdns/cloudflare mode, Caddy additionally
// exposes https://{svc}.{domain} on 80/443 — which is the ONLY surface the
// user should port-forward to the public internet. Keeping port bindings on
// 0.0.0.0 (rather than loopback-only) does not weaken that boundary: whether
// the LAN port map is reachable from the internet is governed by the router's
// port-forwarding rules, not by the container's bindHost. Forwarding only
// 80/443 keeps every admin port LAN-only; forwarding nothing keeps the whole
// stack LAN-only. Binding to 127.0.0.1 would just make LAN access impossible
// too, which was the bug the user reported.

// Caddy needs DNS plugins (caddy-dns/cloudflare, caddy-dns/duckdns) only for
// DNS-01 ACME challenges, i.e. duckdns and cloudflare remote modes. In LAN
// mode the stock image is enough and ~80 MB lighter. For remote modes we
// prefer a prebuilt image on ghcr; the build: block is the fallback when
// that pull fails.
const CADDY_PREBUILT_IMAGE = "ghcr.io/lavx/arrstack-caddy";
const CADDY_PREBUILT_TAG = "latest";
function resolveCaddyImage(svc: Service, remoteMode: ComposeOptions["remoteMode"]) {
  if (svc.id !== "caddy") {
    return { image: svc.image, tag: svc.tag, build: svc.build };
  }
  if (remoteMode === "none") {
    return { image: "caddy", tag: "latest", build: undefined };
  }
  return {
    image: CADDY_PREBUILT_IMAGE,
    tag: CADDY_PREBUILT_TAG,
    build: svc.build,
  };
}

interface ComposeContext {
  installDir: string;
  storageRoot: string;
  puid: number;
  pgid: number;
  timezone: string;
  services: ServiceContext[];
}

function buildDataMounts(svc: Service, storageRoot: string, extraPaths: string[]): DataMount[] {
  const mounts: DataMount[] = [];
  for (const [role, containerPath] of Object.entries(svc.mounts)) {
    // `data` mounts the whole storageRoot into the container (TRaSH layout):
    // the container sees /data/torrents/... and /data/media/... under one
    // shared root so Sonarr/Radarr can hardlink from downloads to media.
    if (role === "data") {
      mounts.push({ src: storageRoot, dst: containerPath });
    } else if (role === "downloads") {
      mounts.push({ src: `${storageRoot}/torrents`, dst: containerPath });
    } else if (role === "tv") {
      mounts.push({ src: `${storageRoot}/media/tv`, dst: containerPath });
    } else if (role === "movies") {
      mounts.push({ src: `${storageRoot}/media/movies`, dst: containerPath });
    } else if (role === "media") {
      mounts.push({ src: `${storageRoot}/media`, dst: containerPath });
    } else if (role === "transcode_cache") {
      mounts.push({ src: `${storageRoot}/transcode_cache`, dst: containerPath });
    } else {
      mounts.push({ src: `${storageRoot}/${role}`, dst: containerPath });
    }
  }
  // Extra scan paths (additional drives) only get mounted into services that
  // already have a /data mount — i.e. the media/downloads pipeline. Mount each
  // under /data/extra-N so paths like /data/extra-0/movies are valid inside
  // containers and match what install.ts passes to the arr APIs.
  const hasDataMount = Object.keys(svc.mounts).includes("data");
  if (hasDataMount) {
    extraPaths.forEach((extraPath, i) => {
      mounts.push({ src: extraPath, dst: `/data/extra-${i}` });
    });
  }
  return mounts;
}

function buildDevices(svc: Service, gpu: ComposeOptions["gpu"]): string[] {
  // extraDevices are service-intrinsic (e.g. /dev/net/tun for gluetun) and
  // must be emitted regardless of GPU wiring.
  const devices: string[] = [...svc.extraDevices];
  if (!svc.hwaccelSupport || gpu.vendor === "none") return devices;
  if (gpu.vendor === "nvidia") return devices;
  // Intel/AMD use the DRI render node. `gpu.device_name` holds the
  // human-readable lspci string and must not be passed to Docker as a path.
  if (gpu.vendor === "intel" || gpu.vendor === "amd") devices.push("/dev/dri/renderD128");
  return devices;
}

function buildGroupAdd(svc: Service, gpu: ComposeOptions["gpu"]): string[] {
  if (!svc.hwaccelSupport || gpu.vendor === "none") return [];
  if (gpu.vendor === "nvidia") return [];
  const groups: string[] = [];
  if (gpu.render_gid !== undefined) groups.push(String(gpu.render_gid));
  if (gpu.video_gid !== undefined) groups.push(String(gpu.video_gid));
  return groups;
}

function isVpnRouted(svc: Service, vpn: ComposeOptions["vpn"]): boolean {
  return svc.id === "qbittorrent" && vpn.enabled;
}

// gluetun ships a built-in HEALTHCHECK, but we render one explicitly so that
// `depends_on: { gluetun: { condition: service_healthy } }` keeps working even
// if a future image drops it. `/gluetun-entrypoint healthcheck` pings the
// tunnel; start_period covers the WireGuard handshake + firewall setup before
// the first probe counts against retries.
const GLUETUN_HEALTHCHECK: Healthcheck = {
  test: '["CMD", "/gluetun-entrypoint", "healthcheck"]',
  interval: "10s",
  timeout: "10s",
  retries: 6,
  start_period: "30s",
};

// Translates the wizard's VPN state into the env vars gluetun expects
// (VPN_SERVICE_PROVIDER / VPN_TYPE / WIREGUARD_* / SERVER_COUNTRIES / custom
// endpoint tuple). Only emitted for the gluetun service and only when VPN
// is enabled.
function buildGluetunEnv(vpn: ComposeOptions["vpn"]): EnvEntry[] {
  if (!vpn.enabled) return [];
  const env: EnvEntry[] = [];
  if (vpn.provider) env.push({ key: "VPN_SERVICE_PROVIDER", value: vpn.provider });
  env.push({ key: "VPN_TYPE", value: vpn.type ?? "wireguard" });
  if (vpn.private_key) env.push({ key: "WIREGUARD_PRIVATE_KEY", value: vpn.private_key });
  if (vpn.addresses) env.push({ key: "WIREGUARD_ADDRESSES", value: vpn.addresses });
  if (vpn.countries) env.push({ key: "SERVER_COUNTRIES", value: vpn.countries });
  if (vpn.provider === "custom") {
    if (vpn.endpoint_ip) env.push({ key: "VPN_ENDPOINT_IP", value: vpn.endpoint_ip });
    if (vpn.endpoint_port !== undefined) {
      env.push({ key: "VPN_ENDPOINT_PORT", value: String(vpn.endpoint_port) });
    }
    if (vpn.server_public_key) {
      env.push({ key: "WIREGUARD_PUBLIC_KEY", value: vpn.server_public_key });
    }
  }
  return env;
}

export function buildComposeContext(services: Service[], opts: ComposeOptions): ComposeContext {
  // Every VPN-routed service runs inside gluetun's netns and gets `ports: []`,
  // so its WebUI port has to be published by gluetun instead. Collect those
  // ports once and hand them to the gluetun service below. Generic, so any
  // future routed service (not just qBittorrent) is exposed automatically.
  const vpnRoutedPorts: number[] = opts.vpn.enabled
    ? services.filter((svc) => isVpnRouted(svc, opts.vpn)).flatMap((svc) => svc.ports)
    : [];

  const serviceContexts: ServiceContext[] = services.map((svc) => {
    const vpnNetwork = isVpnRouted(svc, opts.vpn);
    const apiKeyEnv = svc.apiKeyEnv;
    const apiKey = apiKeyEnv ? opts.apiKeys[svc.id] : undefined;

    const extraEnv: EnvEntry[] = Object.entries(svc.envVars).map(([key, value]) => ({
      key,
      value,
    }));
    if (svc.id === "gluetun") {
      extraEnv.push(...buildGluetunEnv(opts.vpn));
    }

    // gluetun publishes its own declared ports plus every VPN-routed service's
    // ports. VPN-routed services themselves publish nothing (they share
    // gluetun's network). Everything else binds its declared ports directly.
    const ownPorts =
      svc.id === "gluetun" ? [...svc.ports, ...vpnRoutedPorts] : vpnNetwork ? [] : svc.ports;
    const ports: PortBinding[] = ownPorts.map((p) => ({ binding: `0.0.0.0:${p}:${p}` }));

    // VPN-routed services must wait for gluetun to be *healthy* (tunnel up)
    // before they attach to its netns, otherwise a gluetun restart mid-boot
    // leaves a stale namespace path and `docker compose up` aborts with the
    // cryptic `lstat /proc/<pid>/ns/net: no such file or directory`.
    const dependsOn: DependsOnEntry[] = svc.dependsOn.map((service) => ({ service }));
    if (vpnNetwork) {
      dependsOn.push({ service: "gluetun", condition: "service_healthy" });
    }
    const dependsOnLongForm = dependsOn.some((d) => d.condition !== undefined);

    const healthcheck = svc.id === "gluetun" ? GLUETUN_HEALTHCHECK : undefined;

    const caddyImage = resolveCaddyImage(svc, opts.remoteMode);

    const dataMounts = buildDataMounts(svc, opts.storageRoot, opts.extraPaths);
    if (svc.id === "caddy") {
      // The renderer writes {installDir}/Caddyfile to disk, but the container
      // needs it at /etc/caddy/Caddyfile. Without this explicit mount Caddy
      // falls back to its built-in "Caddy works!" welcome page on every
      // vhost — which is the bug the user hit at http://{svc}.arrstack.local.
      dataMounts.push({
        src: `${opts.installDir}/Caddyfile`,
        dst: "/etc/caddy/Caddyfile",
        mode: "ro",
      });
    }

    return {
      id: svc.id,
      image: caddyImage.image,
      tag: caddyImage.tag,
      build: caddyImage.build,
      configPath: svc.configPath,
      ports,
      apiKeyEnv,
      apiKey,
      extraEnv,
      dataMounts,
      devices: buildDevices(svc, opts.gpu),
      capAdd: svc.capAdd,
      groupAdd: buildGroupAdd(svc, opts.gpu),
      dependsOn,
      dependsOnLongForm,
      healthcheck,
      vpnNetwork,
    };
  });

  return {
    installDir: opts.installDir,
    storageRoot: opts.storageRoot,
    puid: opts.puid,
    pgid: opts.pgid,
    timezone: opts.timezone,
    services: serviceContexts,
  };
}

export function renderCompose(services: Service[], opts: ComposeOptions): string {
  const context = buildComposeContext(services, opts);
  return renderFile("compose.yml.hbs", context as unknown as Record<string, unknown>);
}
