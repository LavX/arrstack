import { describe, test, expect } from "bun:test";
import { buildStateFromWizard, type WizardState } from "../../../src/ui/wizard/useWizardState.js";

function makeWizardState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    storageRoot: "/data",
    extraPaths: "",
    adminUsername: "admin",
    adminPassword: "test-pass",
    detectedGpus: [],
    gpuVendor: "none",
    renderGid: null,
    videoGid: null,
    services: [],
    remoteMode: "none",
    remoteDomain: "",
    remoteToken: "",
    localDnsEnabled: false,
    localDnsTld: "local",
    timezone: "Europe/Budapest",
    puid: 1000,
    pgid: 1000,
    vpnMode: "none",
    hostname: "myserver",
    loading: false,
    ...overrides,
  };
}

describe("buildStateFromWizard", () => {
  test("produces valid State with schema_version 1", () => {
    const state = buildStateFromWizard(makeWizardState());
    expect(state.schema_version).toBe(1);
  });

  test("maps storage_root correctly", () => {
    const state = buildStateFromWizard(makeWizardState({ storageRoot: "/mnt/media" }));
    expect(state.storage_root).toBe("/mnt/media");
  });

  test("parses comma-separated extra_paths", () => {
    const state = buildStateFromWizard(
      makeWizardState({ extraPaths: "/mnt/hdd1, /mnt/hdd3" })
    );
    expect(state.extra_paths).toEqual(["/mnt/hdd1", "/mnt/hdd3"]);
  });

  test("trims whitespace from extra_paths entries", () => {
    const state = buildStateFromWizard(
      makeWizardState({ extraPaths: "  /mnt/a ,  /mnt/b  " })
    );
    expect(state.extra_paths).toEqual(["/mnt/a", "/mnt/b"]);
  });

  test("produces empty extra_paths when field is blank", () => {
    const state = buildStateFromWizard(makeWizardState({ extraPaths: "" }));
    expect(state.extra_paths).toEqual([]);
  });

  test("includes checked services in services_enabled", () => {
    const state = buildStateFromWizard(
      makeWizardState({
        services: [
          { id: "sonarr", name: "Sonarr", checked: true },
          { id: "radarr", name: "Radarr", checked: false },
        ],
      })
    );
    expect(state.services_enabled).toContain("sonarr");
    expect(state.services_enabled).not.toContain("radarr");
  });

  test("excludes unchecked services from services_enabled", () => {
    const state = buildStateFromWizard(
      makeWizardState({
        services: [
          { id: "jellyfin", name: "Jellyfin", checked: false },
          { id: "prowlarr", name: "Prowlarr", checked: true },
        ],
      })
    );
    expect(state.services_enabled).toContain("prowlarr");
    expect(state.services_enabled).toContain("caddy"); // always auto-added
    expect(state.services_enabled).not.toContain("jellyfin"); // unchecked
  });

  test("sets admin username", () => {
    const state = buildStateFromWizard(makeWizardState({ adminUsername: "lavx" }));
    expect(state.admin.username).toBe("lavx");
  });

  test("sets install_dir to ~/arrstack", () => {
    const state = buildStateFromWizard(makeWizardState());
    expect(state.install_dir).toContain("arrstack");
  });

  test("sets timezone", () => {
    const state = buildStateFromWizard(makeWizardState({ timezone: "America/New_York" }));
    expect(state.timezone).toBe("America/New_York");
  });

  test("sets puid and pgid", () => {
    const state = buildStateFromWizard(makeWizardState({ puid: 1001, pgid: 1002 }));
    expect(state.puid).toBe(1001);
    expect(state.pgid).toBe(1002);
  });

  test("sets gpu vendor", () => {
    const state = buildStateFromWizard(
      makeWizardState({
        gpuVendor: "intel",
        detectedGpus: [{ vendor: "intel", name: "UHD 630", pciId: "8086:1234" }],
      })
    );
    expect(state.gpu.vendor).toBe("intel");
  });

  test("sets gpu device_name from detected GPU matching vendor", () => {
    const state = buildStateFromWizard(
      makeWizardState({
        gpuVendor: "amd",
        detectedGpus: [{ vendor: "amd", name: "RX 580", pciId: "1002:abcd" }],
      })
    );
    expect(state.gpu.device_name).toBe("RX 580");
  });

  test("omits gpu device_name when no GPU matches vendor", () => {
    const state = buildStateFromWizard(
      makeWizardState({ gpuVendor: "none", detectedGpus: [] })
    );
    expect(state.gpu.device_name).toBeUndefined();
  });

  test("sets render_gid and video_gid when provided", () => {
    const state = buildStateFromWizard(
      makeWizardState({ renderGid: 993, videoGid: 44 })
    );
    expect(state.gpu.render_gid).toBe(993);
    expect(state.gpu.video_gid).toBe(44);
  });

  test("omits render_gid and video_gid when null", () => {
    const state = buildStateFromWizard(
      makeWizardState({ renderGid: null, videoGid: null })
    );
    expect(state.gpu.render_gid).toBeUndefined();
    expect(state.gpu.video_gid).toBeUndefined();
  });

  test("sets remote_access mode none", () => {
    const state = buildStateFromWizard(makeWizardState({ remoteMode: "none" }));
    expect(state.remote_access.mode).toBe("none");
  });

  test("sets remote_access domain and token for duckdns", () => {
    const state = buildStateFromWizard(
      makeWizardState({
        remoteMode: "duckdns",
        remoteDomain: "mystack",
        remoteToken: "abc123",
      })
    );
    expect(state.remote_access.mode).toBe("duckdns");
    expect(state.remote_access.domain).toBe("mystack");
    expect(state.remote_access.token).toBe("abc123");
  });

  test("omits remote domain/token when blank", () => {
    const state = buildStateFromWizard(
      makeWizardState({ remoteMode: "none", remoteDomain: "", remoteToken: "" })
    );
    expect(state.remote_access.domain).toBeUndefined();
    expect(state.remote_access.token).toBeUndefined();
  });

  test("sets local_dns enabled and tld", () => {
    const state = buildStateFromWizard(
      makeWizardState({ localDnsEnabled: true, localDnsTld: "home" })
    );
    expect(state.local_dns.enabled).toBe(true);
    expect(state.local_dns.tld).toBe("home");
  });

  test("sets vpn disabled when vpnMode is none", () => {
    const state = buildStateFromWizard(makeWizardState({ vpnMode: "none" }));
    expect(state.vpn.enabled).toBe(false);
    expect(state.vpn.provider).toBeUndefined();
  });

  test("sets vpn enabled with provider when vpnMode is gluetun", () => {
    const state = buildStateFromWizard(makeWizardState({ vpnMode: "gluetun" }));
    expect(state.vpn.enabled).toBe(true);
    expect(state.vpn.provider).toBe("gluetun");
  });

  test("api_keys is an object", () => {
    const state = buildStateFromWizard(makeWizardState());
    expect(typeof state.api_keys).toBe("object");
  });

  test("generates api_key for service with apiKeyEnv in catalog", () => {
    // prowlarr has apiKeyEnv: PROWLARR__AUTH__APIKEY in the catalog
    const state = buildStateFromWizard(
      makeWizardState({
        services: [{ id: "prowlarr", name: "Prowlarr", checked: true }],
      })
    );
    expect(typeof state.api_keys["prowlarr"]).toBe("string");
    expect(state.api_keys["prowlarr"].length).toBeGreaterThan(0);
  });

  test("does not generate api_key for service without apiKeyEnv", () => {
    // qbittorrent has no apiKeyEnv
    const state = buildStateFromWizard(
      makeWizardState({
        services: [{ id: "qbittorrent", name: "qBittorrent", checked: true }],
      })
    );
    expect(state.api_keys["qbittorrent"]).toBeUndefined();
  });

  test("does not generate api_key for unchecked services", () => {
    const state = buildStateFromWizard(
      makeWizardState({
        services: [{ id: "prowlarr", name: "Prowlarr", checked: false }],
      })
    );
    expect(state.api_keys["prowlarr"]).toBeUndefined();
  });

  test("installer_version is a non-empty string", () => {
    const state = buildStateFromWizard(makeWizardState());
    expect(typeof state.installer_version).toBe("string");
    expect(state.installer_version.length).toBeGreaterThan(0);
  });
});
