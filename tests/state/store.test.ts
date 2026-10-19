import { test, expect, afterEach } from "bun:test";
import { mkdirSync, rmSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readState,
  writeState,
  adminTxtUnreadable,
  adminTxtGuardMessage,
  readAdminCredentials,
} from "../../src/state/store.js";
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
  local_dns: { enabled: false, tld: "local", install_dnsmasq: true },
  vpn: { enabled: false },
  timezone: "Europe/London",
  puid: 1000,
  pgid: 1000,
  subtitle_languages: ["en"],
  api_keys: {},
  secrets: {},
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

test("readState backfills secrets:{} for a state.json written before the field existed", () => {
  mkdirSync(TMP, { recursive: true });
  const { secrets: _drop, ...legacy } = VALID_STATE as State & { secrets?: unknown };
  writeFileSync(join(TMP, "state.json"), JSON.stringify(legacy));
  const result = readState(TMP);
  expect(result?.secrets).toEqual({});
});

test("adminTxtUnreadable: false when admin.txt is absent (fresh install)", () => {
  mkdirSync(TMP, { recursive: true });
  expect(adminTxtUnreadable(TMP)).toBe(false);
});

test("adminTxtUnreadable: false when admin.txt is readable", () => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(join(TMP, "admin.txt"), "password: hunter2\n");
  expect(adminTxtUnreadable(TMP)).toBe(false);
});

test("adminTxtUnreadable: true when admin.txt exists but can't be read", () => {
  // Root bypasses file permissions, so a chmod-000 file is still readable and
  // this case can't be exercised. Skip rather than assert a false negative.
  if (typeof process.getuid === "function" && process.getuid() === 0) return;
  mkdirSync(TMP, { recursive: true });
  const p = join(TMP, "admin.txt");
  writeFileSync(p, "password: hunter2\n");
  chmodSync(p, 0o000);
  expect(adminTxtUnreadable(TMP)).toBe(true);
  chmodSync(p, 0o600); // let afterEach clean up
});

test("readAdminCredentials parses username and password from admin.txt", () => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(
    join(TMP, "admin.txt"),
    "username: admin\npassword: UXsr-v3H8-JpMZ-gqCm\ngenerated: 2026-06-24T23:31:10.664Z\n",
  );
  expect(readAdminCredentials(TMP)).toEqual({
    username: "admin",
    password: "UXsr-v3H8-JpMZ-gqCm",
  });
});

test("readAdminCredentials returns null when admin.txt is absent or incomplete", () => {
  mkdirSync(TMP, { recursive: true });
  expect(readAdminCredentials(TMP)).toBeNull();
  writeFileSync(join(TMP, "admin.txt"), "username: admin\n");
  expect(readAdminCredentials(TMP)).toBeNull();
});

test("adminTxtGuardMessage: null when admin.txt is absent or readable", () => {
  mkdirSync(TMP, { recursive: true });
  expect(adminTxtGuardMessage(TMP)).toBeNull();
  writeFileSync(join(TMP, "admin.txt"), "password: hunter2\n");
  expect(adminTxtGuardMessage(TMP)).toBeNull();
});

test("adminTxtGuardMessage: actionable chown message when admin.txt is unreadable", () => {
  if (typeof process.getuid === "function" && process.getuid() === 0) return;
  mkdirSync(TMP, { recursive: true });
  const p = join(TMP, "admin.txt");
  writeFileSync(p, "password: hunter2\n");
  chmodSync(p, 0o000);
  const msg = adminTxtGuardMessage(TMP);
  expect(msg).not.toBeNull();
  expect(msg).toContain("chown");
  expect(msg).toContain(p);
  chmodSync(p, 0o600);
});
