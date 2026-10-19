import { test, expect, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runResume } from "../../src/usecase/resume.js";
import { writeState } from "../../src/state/store.js";
import { VERSION } from "../../src/version.js";
import type { State } from "../../src/state/schema.js";
import type { InstallResult } from "../../src/usecase/install.js";

const STATE: State = {
  schema_version: 1,
  installer_version: "1.0.0",
  install_dir: "/old/path",
  storage_root: "/data",
  extra_paths: [],
  admin: { username: "admin" },
  services_enabled: ["sonarr"],
  gpu: { vendor: "none" },
  remote_access: { mode: "none" },
  local_dns: { enabled: false, tld: "local", install_dnsmasq: false },
  vpn: { enabled: false },
  timezone: "Europe/London",
  puid: 1000,
  pgid: 1000,
  subtitle_languages: ["en"],
  api_keys: { sonarr: "key" },
  secrets: {},
};

const RESULT: InstallResult = {
  urls: [{ name: "Sonarr", url: "http://localhost:8989", description: "Sonarr" }],
  password: "from-state",
  adminUser: "admin",
};

let created: string[] = [];

function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "arrstack-resume-test-"));
  created.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
  created = [];
});

test("runResume passes existing state and admin.txt password to runInstall", async () => {
  const dir = makeDir();
  writeState(dir, { ...STATE, install_dir: dir });
  writeFileSync(join(dir, "admin.txt"), "username: admin\npassword: s3cret-pw\ngenerated: now\n");

  let receivedState: State | null = null;
  let receivedPassword = "";
  const result = await runResume(dir, {
    onStep: () => {},
    runInstallFn: async (state, password) => {
      receivedState = state;
      receivedPassword = password;
      return RESULT;
    },
  });

  expect(result).toEqual(RESULT);
  expect(receivedPassword).toBe("s3cret-pw");
  expect(receivedState?.install_dir).toBe(dir);
  expect(receivedState?.installer_version).toBe(VERSION);
  expect(receivedState?.services_enabled).toEqual(["sonarr"]);
});

test("runResume rejects when state.json is missing", async () => {
  const dir = makeDir();
  await expect(runResume(dir, { runInstallFn: async () => RESULT })).rejects.toThrow(
    /No state\.json found/,
  );
});

test("runResume rejects when admin.txt is missing", async () => {
  const dir = makeDir();
  writeState(dir, { ...STATE, install_dir: dir });
  await expect(runResume(dir, { runInstallFn: async () => RESULT })).rejects.toThrow(
    /No readable admin\.txt found/,
  );
});
