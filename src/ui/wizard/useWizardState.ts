import { useState, useEffect } from "react";
import os from "node:os";
import { detectGpus, type GpuInfo } from "../../platform/gpu.js";
import { resolveRenderVideoGids } from "../../platform/groups.js";
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
  localDnsTld: string;

  // System
  timezone: string;
  puid: number;
  pgid: number;
  vpnMode: "none" | "gluetun";

  // Meta
  hostname: string;
  loading: boolean;
}

export function buildStateFromWizard(ws: WizardState): State {
  const catalog = loadCatalog();
  const enabledIds = ws.services.filter((s) => s.checked).map((s) => s.id);

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
    install_dir: "/opt/arrstack",
    storage_root: ws.storageRoot,
    extra_paths: extraPaths,
    admin: { username: ws.adminUsername },
    services_enabled: enabledIds,
    gpu,
    remote_access: remoteAccess,
    local_dns: { enabled: ws.localDnsEnabled, tld: ws.localDnsTld },
    vpn: {
      enabled: ws.vpnMode !== "none",
      ...(ws.vpnMode !== "none" && { provider: ws.vpnMode }),
    },
    timezone: ws.timezone,
    puid: ws.puid,
    pgid: ws.pgid,
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

function buildInitialServices(existingEnabled?: string[]): WizardServiceItem[] {
  const catalog = loadCatalog();
  const defaultIds = new Set(getDefaultServices().map((s) => s.id));
  const existingSet = existingEnabled ? new Set(existingEnabled) : null;

  return catalog.map((svc) => ({
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

  const [storageRoot, setStorageRoot] = useState(
    existingState?.storage_root ?? "/srv/arrstack"
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
    if (!existingState?.vpn) return "none";
    return existingState.vpn.enabled
      ? ((existingState.vpn.provider ?? "gluetun") as WizardState["vpnMode"])
      : "none";
  });

  const [hostname] = useState(() => {
    try {
      return os.hostname();
    } catch {
      return "localhost";
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      const [gpus, gids] = await Promise.all([
        detectGpus(),
        Promise.resolve(resolveRenderVideoGids()),
      ]);

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
      localDnsTld,
      timezone: tz,
      puid: puidState,
      pgid: pgidState,
      vpnMode,
      hostname,
      loading,
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

    // Meta
    hostname,
    loading,

    // Converter
    toState,
  };
}
