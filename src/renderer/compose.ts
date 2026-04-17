import type { Service } from "../catalog/schema.js";
import { renderFile } from "./engine.js";

export interface ComposeOptions {
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
  };
}

interface DataMount {
  src: string;
  dst: string;
}

interface EnvEntry {
  key: string;
  value: string;
}

interface ServiceContext {
  id: string;
  image: string;
  tag: string;
  configPath: string;
  ports: number[];
  apiKeyEnv: string | undefined;
  apiKey: string | undefined;
  extraEnv: EnvEntry[];
  dataMounts: DataMount[];
  devices: string[];
  groupAdd: string[];
  dependsOn: string[];
  vpnNetwork: boolean;
}

interface ComposeContext {
  storageRoot: string;
  puid: number;
  pgid: number;
  timezone: string;
  services: ServiceContext[];
}

function buildDataMounts(svc: Service, storageRoot: string, extraPaths: string[]): DataMount[] {
  const mounts: DataMount[] = [];
  for (const [role, containerPath] of Object.entries(svc.mounts)) {
    if (role === "downloads") {
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
  for (const extraPath of extraPaths) {
    if (!mounts.some((m) => m.src === extraPath)) {
      mounts.push({ src: extraPath, dst: extraPath });
    }
  }
  return mounts;
}

function buildDevices(svc: Service, gpu: ComposeOptions["gpu"]): string[] {
  if (!svc.hwaccelSupport || gpu.vendor === "none") return [];
  if (gpu.vendor === "nvidia") return [];
  if (gpu.device_name) {
    return [gpu.device_name];
  }
  if (gpu.vendor === "intel") return ["/dev/dri/renderD128"];
  if (gpu.vendor === "amd") return ["/dev/dri/renderD128"];
  return [];
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

export function buildComposeContext(services: Service[], opts: ComposeOptions): ComposeContext {
  const serviceContexts: ServiceContext[] = services.map((svc) => {
    const vpnNetwork = isVpnRouted(svc, opts.vpn);
    const apiKeyEnv = svc.apiKeyEnv;
    const apiKey = apiKeyEnv ? opts.apiKeys[svc.id] : undefined;

    const extraEnv: EnvEntry[] = Object.entries(svc.envVars).map(([key, value]) => ({
      key,
      value,
    }));

    return {
      id: svc.id,
      image: svc.image,
      tag: svc.tag,
      configPath: svc.configPath,
      ports: vpnNetwork ? [] : svc.ports,
      apiKeyEnv,
      apiKey,
      extraEnv,
      dataMounts: buildDataMounts(svc, opts.storageRoot, opts.extraPaths),
      devices: buildDevices(svc, opts.gpu),
      groupAdd: buildGroupAdd(svc, opts.gpu),
      dependsOn: svc.dependsOn,
      vpnNetwork,
    };
  });

  return {
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
