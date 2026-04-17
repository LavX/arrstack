import { test, expect, afterEach } from "bun:test";
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readState, writeState } from "../../src/state/store.js";
import type { State } from "../../src/state/schema.js";

const TMP = join(tmpdir(), `arrstack-state-test-${process.pid}`);

const VALID_STATE: State = {
  schema_version: 1,
  installer_version: "0.1.0",
  install_dir: "/opt/arrstack",
  storage_root: "/data",
  extra_paths: [],
  admin: { username: "admin" },
  services_enabled: ["sonarr", "radarr", "jellyfin"],
  gpu: { vendor: "none" },
  remote_access: { mode: "none" },
  local_dns: { enabled: false, tld: "local" },
  vpn: { enabled: false },
  timezone: "Europe/London",
  puid: 1000,
  pgid: 1000,
  subtitle_languages: ["en"],
  api_keys: {},
};

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

test("readState returns null when file missing", () => {
  mkdirSync(TMP, { recursive: true });
  const result = readState(TMP);
  expect(result).toBeNull();
});

test("roundtrip: write then read returns same data", () => {
  mkdirSync(TMP, { recursive: true });
  writeState(TMP, VALID_STATE);
  const result = readState(TMP);
  expect(result).toEqual(VALID_STATE);
});

test("state file is written with mode 0o600", () => {
  mkdirSync(TMP, { recursive: true });
  writeState(TMP, VALID_STATE);
  const stats = statSync(join(TMP, "state.json"));
  const mode = stats.mode & 0o777;
  expect(mode).toBe(0o600);
});

test("schema validation rejects invalid data", () => {
  mkdirSync(TMP, { recursive: true });
  const invalid = { ...VALID_STATE, schema_version: 2 };
  // Write raw invalid JSON bypassing writeState validation
  writeFileSync(join(TMP, "state.json"), JSON.stringify(invalid));
  expect(() => readState(TMP)).toThrow();
});

test("readState rejects state missing required fields", () => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(join(TMP, "state.json"), JSON.stringify({ schema_version: 1 }));
  expect(() => readState(TMP)).toThrow();
});
