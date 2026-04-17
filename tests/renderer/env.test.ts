import { describe, expect, test } from "bun:test";
import { renderEnvFile } from "../../src/renderer/env";

const baseOpts = {
  puid: 1000,
  pgid: 1000,
  timezone: "America/New_York",
  installDir: "/opt/arrstack",
  storageRoot: "/mnt/storage",
  adminUsername: "admin",
  adminPassword: "s3cret",
  apiKeys: {
    sonarr: "sonarr-key-abc",
    radarr: "radarr-key-def",
  },
};

describe("renderEnvFile", () => {
  test("contains PUID and PGID", () => {
    const output = renderEnvFile(baseOpts);
    expect(output).toContain("PUID=1000");
    expect(output).toContain("PGID=1000");
  });

  test("contains TZ", () => {
    const output = renderEnvFile(baseOpts);
    expect(output).toContain("TZ=America/New_York");
  });

  test("contains INSTALL_DIR and STORAGE_ROOT", () => {
    const output = renderEnvFile(baseOpts);
    expect(output).toContain("INSTALL_DIR=/opt/arrstack");
    expect(output).toContain("STORAGE_ROOT=/mnt/storage");
  });

  test("contains ADMIN_USERNAME and ADMIN_PASSWORD", () => {
    const output = renderEnvFile(baseOpts);
    expect(output).toContain("ADMIN_USERNAME=admin");
    expect(output).toContain("ADMIN_PASSWORD=s3cret");
  });

  test("contains per-service API key env vars", () => {
    const output = renderEnvFile(baseOpts);
    expect(output).toContain("SONARR__AUTH__APIKEY=sonarr-key-abc");
    expect(output).toContain("RADARR__AUTH__APIKEY=radarr-key-def");
  });

  test("no CF_API_TOKEN when not provided", () => {
    const output = renderEnvFile(baseOpts);
    expect(output).not.toContain("CF_API_TOKEN");
  });

  test("includes CF_API_TOKEN when provided", () => {
    const output = renderEnvFile({ ...baseOpts, cfApiToken: "cf-token-xyz" });
    expect(output).toContain("CF_API_TOKEN=cf-token-xyz");
  });

  test("includes DUCKDNS_TOKEN when provided", () => {
    const output = renderEnvFile({ ...baseOpts, duckdnsToken: "duck-token-xyz" });
    expect(output).toContain("DUCKDNS_TOKEN=duck-token-xyz");
  });

  test("output is key=value line format", () => {
    const output = renderEnvFile(baseOpts);
    const lines = output.trim().split("\n");
    for (const line of lines) {
      expect(line).toMatch(/^[A-Z0-9_]+=.*$/);
    }
  });
});
