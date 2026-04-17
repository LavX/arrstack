import { useState, useEffect } from "react";
import os from "node:os";
import { statfsSync } from "node:fs";
import { detectGpus, type GpuInfo } from "../../platform/gpu.js";
import { resolveRenderVideoGids } from "../../platform/groups.js";
import { isDockerInstalled, isDockerRunning, isComposeV2 } from "../../platform/docker.js";
import { checkPortFree, findFreePort } from "../../platform/ports.js";
import { getDefaultServices, loadCatalog } from "../../catalog/index.js";
import { generatePassword, generateApiKey } from "../../lib/random.js";
import { VERSION } from "../../version.js";
import type { State } from "../../state/schema.js";

export interface WizardServiceItem {
  id: string;
  name: string;
  checked: boolean;
  port?: number;
  description?: string;
}

export interface WizardState {
  // Storage
  storageRoot: string;
  extraPaths: string;

  // Admin
  adminUsername: string;
  adminPassword: string;

  // GPU
  detectedGpus: GpuInfo[];
  gpuVendor: "none" | "intel" | "amd" | "nvidia";
  renderGid: number | null;
  videoGid: number | null;

  // Services
  services: WizardServiceItem[];

  // Remote access
  remoteMode: "none" | "duckdns" | "cloudflare";
  remoteDomain: string;
  remoteToken: string;

  // Local DNS
  localDnsEnabled: boolean;
  localDnsInstallDnsmasq: boolean;
  localDnsTld: string;

  // System
  timezone: string;
  puid: number;
  pgid: number;
  vpnMode: "none" | "gluetun";
  // VPN (gluetun) provider + WireGuard credentials. Only read when
  // vpnMode === "gluetun".
  vpnProvider: "mullvad" | "protonvpn" | "custom";
  vpnPrivateKey: string;
  vpnAddresses: string;    // e.g. "10.64.222.21/32"
  vpnCountries: string;    // optional, comma-separated (e.g. "Switzerland, Sweden")
  // custom-provider-only
  vpnEndpointIp: string;
  vpnEndpointPort: string; // kept as string in UI; parsed on submit
  vpnServerPublicKey: string;
  subtitleLanguages: string; // user-entered, comma-separated "en, hu"

  // Meta
  hostname: string;
  loading: boolean;

  // Caddy ports (user-editable if 80/443 are taken)
  caddyHttpPort: number;
  caddyHttpsPort: number;

  // Status (for status strip)
  dockerOk: boolean;
  portsOk: boolean;
  diskInfo: Array<{ path: string; freeGb: number }>;
  portConflicts: string[]; // human-readable conflict messages
}

export function buildStateFromWizard(ws: WizardState): State {
  const catalog = loadCatalog();
  const enabledIds = ws.services.filter((s) => s.checked).map((s) => s.id);

  // Auto-add infrastructure services based on user choices
  enabledIds.push("caddy"); // always included
  if (ws.remoteMode === "cloudflare") enabledIds.push("cloudflare-ddns");
  if (ws.remoteMode === "duckdns") enabledIds.push("duckdns-updater");
  if (ws.localDnsEnabled && ws.localDnsInstallDnsmasq) enabledIds.push("dnsmasq");
  if (ws.vpnMode === "gluetun" && !enabledIds.includes("gluetun")) enabledIds.push("gluetun");

  // Bazarr+ bundle: when bazarr is checked, auto-add its dependencies
  if (enabledIds.includes("bazarr")) {
    for (const dep of ["flaresolverr", "opensubtitles-scraper", "ai-subtitle-translator"]) {
      if (!enabledIds.includes(dep)) enabledIds.push(dep);
    }
  }

  const extraPaths = ws.extraPaths
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const apiKeys: Record<string, string> = {};
  for (const id of enabledIds) {
    const svc = catalog.find((s) => s.id === id);
    if (svc?.apiKeyEnv) {
      apiKeys[id] = generateApiKey();
    }
  }

  const gpu: State["gpu"] = {
    vendor: ws.gpuVendor,
    ...(ws.detectedGpus.length > 0 && {
      device_name: ws.detectedGpus.find((g) => g.vendor === ws.gpuVendor)?.name,
    }),
    ...(ws.renderGid !== null && { render_gid: ws.renderGid }),
    ...(ws.videoGid !== null && { video_gid: ws.videoGid }),
  };

  const remoteAccess: State["remote_access"] = {
    mode: ws.remoteMode,
    ...(ws.remoteDomain && { domain: ws.remoteDomain }),
    ...(ws.remoteToken && { token: ws.remoteToken }),
  };

  return {
    schema_version: 1,
    installer_version: VERSION,
    install_dir: `${process.env.HOME}/arrstack`,
    storage_root: ws.storageRoot,
    extra_paths: extraPaths,
    admin: { username: ws.adminUsername },
    services_enabled: enabledIds,
    gpu,
    remote_access: remoteAccess,
    local_dns: {
      enabled: ws.localDnsEnabled,
      tld: ws.localDnsTld,
      install_dnsmasq: ws.localDnsInstallDnsmasq,
    },
    vpn: (() => {
      if (ws.vpnMode === "none") return { enabled: false };
      const base: State["vpn"] = {
        enabled: true,
        provider: ws.vpnProvider,
        type: "wireguard",
      };
      if (ws.vpnPrivateKey.trim()) base.private_key = ws.vpnPrivateKey.trim();
      if (ws.vpnAddresses.trim()) base.addresses = ws.vpnAddresses.trim();
      if (ws.vpnCountries.trim()) base.countries = ws.vpnCountries.trim();
      if (ws.vpnProvider === "custom") {
        if (ws.vpnEndpointIp.trim()) base.endpoint_ip = ws.vpnEndpointIp.trim();
        const port = Number(ws.vpnEndpointPort.trim());
        if (Number.isFinite(port) && port > 0) base.endpoint_port = port;
        if (ws.vpnServerPublicKey.trim()) base.server_public_key = ws.vpnServerPublicKey.trim();
      }
      return base;
    })(),
    timezone: ws.timezone,
    puid: ws.puid,
    pgid: ws.pgid,
    subtitle_languages: (ws.subtitleLanguages ?? "en")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[a-z]{2}$/.test(s)),
    api_keys: apiKeys,
  };
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// Services managed automatically by the installer, hidden from the user grid
// Infrastructure: caddy, ddns containers, dnsmasq
// Bazarr+ deps: flaresolverr, opensubtitles-scraper, ai-subtitle-translator (bundled with Bazarr+)
const AUTO_MANAGED_SERVICES = new Set([
  "caddy", "cloudflare-ddns", "duckdns-updater", "dnsmasq",
  "flaresolverr", "opensubtitles-scraper", "ai-subtitle-translator",
]);

function buildInitialServices(existingEnabled?: string[]): WizardServiceItem[] {
  const catalog = loadCatalog();
  const defaultIds = new Set(getDefaultServices().map((s) => s.id));
  const existingSet = existingEnabled ? new Set(existingEnabled) : null;

  return catalog
    .filter((svc) => !AUTO_MANAGED_SERVICES.has(svc.id))
    .map((svc) => ({
      id: svc.id,
      name: svc.name,
      checked: existingSet ? existingSet.has(svc.id) : defaultIds.has(svc.id),
      port: svc.adminPort ?? svc.ports[0],
      description: svc.description,
    }));
}

export function useWizardState(existingState?: Partial<State> | null) {
  const timezone = detectTimezone();
  const puid =
    typeof process.getuid === "function" ? process.getuid() : 1000;
  const pgid =
    typeof process.getgid === "function" ? process.getgid() : 1000;

  const defaultStorageRoot = `${process.env.HOME ?? "."}/arrstack/data`;
  const [storageRoot, setStorageRoot] = useState(
    existingState?.storage_root ?? defaultStorageRoot
  );
  const [extraPaths, setExtraPaths] = useState(
    existingState?.extra_paths?.join(", ") ?? ""
  );
  const [adminUsername, setAdminUsername] = useState(
    existingState?.admin?.username ?? "admin"
  );
  const [adminPassword, setAdminPassword] = useState(generatePassword);

  const [detectedGpus, setDetectedGpus] = useState<GpuInfo[]>([]);
  const [gpuVendor, setGpuVendor] = useState<WizardState["gpuVendor"]>(
    (existingState?.gpu?.vendor as WizardState["gpuVendor"]) ?? "none"
  );
  const [renderGid, setRenderGid] = useState<number | null>(
    existingState?.gpu?.render_gid ?? null
  );
  const [videoGid, setVideoGid] = useState<number | null>(
    existingState?.gpu?.video_gid ?? null
  );

  const [services, setServices] = useState<WizardServiceItem[]>(() =>
    buildInitialServices(existingState?.services_enabled)
  );

  const [remoteMode, setRemoteMode] = useState<WizardState["remoteMode"]>(
    (existingState?.remote_access?.mode as WizardState["remoteMode"]) ?? "none"
  );
  const [remoteDomain, setRemoteDomain] = useState(
    existingState?.remote_access?.domain ?? ""
  );
  const [remoteToken, setRemoteToken] = useState(
    existingState?.remote_access?.token ?? ""
  );

  const [localDnsInstallDnsmasq, setLocalDnsInstallDnsmasq] = useState(
    existingState?.local_dns?.install_dnsmasq ?? true,
  );
  const [localDnsEnabled, setLocalDnsEnabled] = useState(
    existingState?.local_dns?.enabled ?? false
  );
  const [localDnsTld, setLocalDnsTld] = useState(
    existingState?.local_dns?.tld ?? "arrstack.local"
  );

  const [tz, setTz] = useState(existingState?.timezone ?? timezone);
  const [puidState, setPuid] = useState(existingState?.puid ?? puid);
  const [pgidState, setPgid] = useState(existingState?.pgid ?? pgid);
  const [vpnMode, setVpnMode] = useState<WizardState["vpnMode"]>(() => {
    // vpn.enabled is what controls whether we route qbittorrent through
    // gluetun; provider now holds a real VPN service name (mullvad, etc.),
    // so we can no longer treat it as "gluetun vs none".
    if (!existingState?.vpn?.enabled) return "none";
    return "gluetun";
  });
  const [vpnProvider, setVpnProvider] = useState<WizardState["vpnProvider"]>(() => {
    const p = existingState?.vpn?.provider;
    return p === "mullvad" || p === "protonvpn" || p === "custom" ? p : "mullvad";
  });
  const [vpnPrivateKey, setVpnPrivateKey] = useState(existingState?.vpn?.private_key ?? "");
  const [vpnAddresses, setVpnAddresses] = useState(existingState?.vpn?.addresses ?? "");
  const [vpnCountries, setVpnCountries] = useState(existingState?.vpn?.countries ?? "");
  const [vpnEndpointIp, setVpnEndpointIp] = useState(existingState?.vpn?.endpoint_ip ?? "");
  const [vpnEndpointPort, setVpnEndpointPort] = useState(
    existingState?.vpn?.endpoint_port ? String(existingState.vpn.endpoint_port) : ""
  );
  const [vpnServerPublicKey, setVpnServerPublicKey] = useState(
    existingState?.vpn?.server_public_key ?? ""
  );
  const [subtitleLanguages, setSubtitleLanguages] = useState<string>(
    existingState?.subtitle_languages?.join(", ") ?? "en",
  );

  const [hostname] = useState(() => {
    try {
      return os.hostname();
    } catch {
      return "localhost";
    }
  });
  const [loading, setLoading] = useState(true);
  const [dockerOk, setDockerOk] = useState(false);
  const [portsOk, setPortsOk] = useState(false);
  const [diskInfo, setDiskInfo] = useState<Array<{ path: string; freeGb: number }>>([]);
  const [portConflicts, setPortConflicts] = useState<string[]>([]);
  const [caddyHttpPort, setCaddyHttpPort] = useState(80);
  const [caddyHttpsPort, setCaddyHttpsPort] = useState(443);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      const [gpus, gids, dockerInstalled, dockerRunning, composeOk, port80, port443] = await Promise.all([
        detectGpus(),
        Promise.resolve(resolveRenderVideoGids()),
        isDockerInstalled(),
        isDockerRunning(),
        isComposeV2(),
        checkPortFree(80),
        checkPortFree(443),
      ]);

      if (cancelled) return;

      setDockerOk(dockerInstalled && dockerRunning && composeOk);
      setPortsOk(port80 && port443);

      // Detect disk space for storage root
      try {
        const stat = statfsSync(storageRoot);
        const freeGb = Math.round((stat.bfree * stat.bsize) / (1024 ** 3));
        setDiskInfo([{ path: storageRoot, freeGb }]);
      } catch {
        setDiskInfo([]);
      }

      // Check Caddy ports (80/443) and suggest alternatives if taken
      if (!port80) {
        const alt = await findFreePort(8080);
        setCaddyHttpPort(alt);
      }
      if (!port443) {
        const alt = await findFreePort(8443);
        setCaddyHttpsPort(alt);
      }

      // Check and auto-remap service ports
      const conflicts: string[] = [];
      const catalog = loadCatalog();
      const updatedServices = [...services];
      let changed = false;
      for (let i = 0; i < updatedServices.length; i++) {
        const svc = updatedServices[i];
        if (!svc.port || svc.port === 80 || svc.port === 443) continue;
        const free = await checkPortFree(svc.port);
        if (!free) {
          const alt = await findFreePort(svc.port + 1);
          conflicts.push(`${svc.name}:${svc.port} in use, remapped to ${alt}`);
          updatedServices[i] = { ...svc, port: alt };
          changed = true;
        }
      }
      if (changed) setServices(updatedServices);
      if (conflicts.length > 0) setPortConflicts(conflicts);

      if (cancelled) return;

      setDetectedGpus(gpus);

      if (!existingState?.gpu?.render_gid && gids.renderGid !== null) {
        setRenderGid(gids.renderGid);
      }
      if (!existingState?.gpu?.video_gid && gids.videoGid !== null) {
        setVideoGid(gids.videoGid);
      }

      // Auto-select GPU vendor if not already set via existingState
      if (!existingState?.gpu?.vendor || existingState.gpu.vendor === "none") {
        const knownVendors: Array<"intel" | "amd" | "nvidia"> = [
          "intel",
          "amd",
          "nvidia",
        ];
        const detected = gpus.find((g) =>
          knownVendors.includes(g.vendor as "intel" | "amd" | "nvidia")
        );
        if (detected) {
          setGpuVendor(detected.vendor as "intel" | "amd" | "nvidia");
        }
      }

      setLoading(false);
    }

    detect().catch(() => setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleService(id: string) {
    setServices((prev) =>
      prev.map((svc) =>
        svc.id === id ? { ...svc, checked: !svc.checked } : svc
      )
    );
  }

  function toState(): State {
    const ws: WizardState = {
      storageRoot,
      extraPaths,
      adminUsername,
      adminPassword,
      detectedGpus,
      gpuVendor,
      renderGid,
      videoGid,
      services,
      remoteMode,
      remoteDomain,
      remoteToken,
      localDnsEnabled,
      localDnsInstallDnsmasq,
      localDnsTld,
      timezone: tz,
      puid: puidState,
      pgid: pgidState,
      vpnMode,
      vpnProvider,
      vpnPrivateKey,
      vpnAddresses,
      vpnCountries,
      vpnEndpointIp,
      vpnEndpointPort,
      vpnServerPublicKey,
      subtitleLanguages,
      hostname,
      loading,
      caddyHttpPort,
      caddyHttpsPort,
      dockerOk,
      portsOk,
      diskInfo,
      portConflicts,
    };
    return buildStateFromWizard(ws);
  }

  return {
    // Storage
    storageRoot,
    setStorageRoot,
    extraPaths,
    setExtraPaths,

    // Admin
    adminUsername,
    setAdminUsername,
    adminPassword,
    setAdminPassword,

    // GPU
    detectedGpus,
    gpuVendor,
    setGpuVendor,
    renderGid,
    setRenderGid,
    videoGid,
    setVideoGid,

    // Services
    services,
    setServices,
    toggleService,

    // Remote access
    remoteMode,
    setRemoteMode,
    remoteDomain,
    setRemoteDomain,
    remoteToken,
    setRemoteToken,

    // Local DNS
    localDnsEnabled,
    setLocalDnsEnabled,
    localDnsInstallDnsmasq,
    setLocalDnsInstallDnsmasq,
    localDnsTld,
    setLocalDnsTld,

    // System
    timezone: tz,
    setTimezone: setTz,
    puid: puidState,
    setPuid,
    pgid: pgidState,
    setPgid,
    vpnMode,
    setVpnMode,
    vpnProvider,
    setVpnProvider,
    vpnPrivateKey,
    setVpnPrivateKey,
    vpnAddresses,
    setVpnAddresses,
    vpnCountries,
    setVpnCountries,
    vpnEndpointIp,
    setVpnEndpointIp,
    vpnEndpointPort,
    setVpnEndpointPort,
    vpnServerPublicKey,
    setVpnServerPublicKey,
    subtitleLanguages,
    setSubtitleLanguages,

    // Meta
    hostname,
    loading,

    // Status
    dockerOk,
    portsOk,
    diskInfo,
    portConflicts,

    // Caddy ports
    caddyHttpPort,
    setCaddyHttpPort,
    caddyHttpsPort,
    setCaddyHttpsPort,

    // Converter
    toState,
  };
}
