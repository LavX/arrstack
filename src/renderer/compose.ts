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
}

interface EnvEntry {
  key: string;
  value: string;
}

interface PortBinding {
  binding: string; // e.g. "127.0.0.1:8989:8989" or "0.0.0.0:443:443"
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
  dependsOn: string[];
  vpnNetwork: boolean;
}

// Services that always need to be reachable from outside the host.
// In LAN mode (no remote access) we open every service so users can hit
// http://<host-ip>:<port>. In duckdns/cloudflare mode we lock admin ports
// to loopback so Caddy is the only external surface.
const ALWAYS_PUBLIC = new Set(["caddy", "gluetun"]);

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

    const bindHost =
      ALWAYS_PUBLIC.has(svc.id) || opts.remoteMode === "none"
        ? "0.0.0.0"
        : "127.0.0.1";
    const ports: PortBinding[] = vpnNetwork
      ? []
      : svc.ports.map((p) => ({ binding: `${bindHost}:${p}:${p}` }));

    return {
      id: svc.id,
      image: svc.image,
      tag: svc.tag,
      build: svc.build,
      configPath: svc.configPath,
      ports,
      apiKeyEnv,
      apiKey,
      extraEnv,
      dataMounts: buildDataMounts(svc, opts.storageRoot, opts.extraPaths),
      devices: buildDevices(svc, opts.gpu),
      capAdd: svc.capAdd,
      groupAdd: buildGroupAdd(svc, opts.gpu),
      dependsOn: svc.dependsOn,
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
