import { test, expect, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runUpdate, type UpdateDeps } from "../../src/usecase/update.js";
import { writeState } from "../../src/state/store.js";
import type { State } from "../../src/state/schema.js";

const VALID_STATE: State = {
  schema_version: 1,
  installer_version: "0.1.0",
  install_dir: "/opt/arrstack",
  storage_root: "/data",
  extra_paths: [],
  admin: { username: "admin" },
  services_enabled: ["sonarr"],
  gpu: { vendor: "none" },
  remote_access: { mode: "none" },
  local_dns: { enabled: false, tld: "local", install_dnsmasq: true },
  vpn: { enabled: false },
  timezone: "Europe/London",
  puid: 1000,
  pgid: 1000,
  subtitle_languages: ["en"],
  api_keys: {},
};

let created: string[] = [];

function makeInstallDir(withCompose = true, withState = true): string {
  const dir = mkdtempSync(join(tmpdir(), "arrstack-update-test-"));
  created.push(dir);
  if (withCompose) writeFileSync(join(dir, "docker-compose.yml"), "services: {}\n");
  if (withState) writeState(dir, { ...VALID_STATE, install_dir: dir });
  return dir;
}

afterEach(() => {
  for (const d of created) rmSync(d, { recursive: true, force: true });
  created = [];
});

interface Call {
  argv: string[];
}

async function silently<T>(fn: () => Promise<T>): Promise<T> {
  const origLog = console.log;
  const origWrite = process.stdout.write.bind(process.stdout);
  console.log = () => {};
  process.stdout.write = () => true;
  try {
    return await fn();
  } finally {
    console.log = origLog;
    process.stdout.write = origWrite;
  }
}

function makeDeps(overrides: Partial<UpdateDeps> = {}): { deps: UpdateDeps; calls: Call[]; pruneCalled: { value: boolean } } {
  const calls: Call[] = [];
  const pruneCalled = { value: false };
  const deps: UpdateDeps = {
    runStreaming: async (argv, onLine) => {
      calls.push({ argv });
      onLine("mock output line");
      return { ok: true, code: 0 };
    },
    captureImages: async () => new Map([["sonarr", "sha256:aaaaaaaaaaaaaaaa"]]),
    pruneImages: async () => {
      pruneCalled.value = true;
      return { ok: true, message: "Total reclaimed space: 0B" };
    },
    checkHealth: async () => true,
    now: Date.now,
    ...overrides,
  };
  return { deps, calls, pruneCalled };
}

test("runUpdate writes update.log with ISO-8601 timestamps", async () => {
  const dir = makeInstallDir();
  const { deps } = makeDeps();

  await silently(() => runUpdate(dir, deps));

  const logPath = join(dir, "update.log");
  expect(existsSync(logPath)).toBe(true);
  const contents = readFileSync(logPath, "utf-8");
  const lines = contents.trim().split("\n");
  expect(lines.length).toBeGreaterThan(0);
  const iso8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z /;
  for (const line of lines) {
    expect(line).toMatch(iso8601);
  }

  const mode = statSync(logPath).mode & 0o777;
  expect(mode & 0o644).toBe(0o644);
});

test("runUpdate runs build, pull --ignore-buildable, up -d --remove-orphans, and prune in order", async () => {
  const dir = makeInstallDir();
  const { deps, calls, pruneCalled } = makeDeps();

  await silently(() => runUpdate(dir, deps));

  expect(calls.length).toBe(3);
  expect(calls[0].argv.slice(0, 3)).toEqual(["docker", "compose", "-f"]);
  expect(calls[0].argv.slice(-2)).toEqual(["build", "--pull"]);
  expect(calls[1].argv.slice(-2)).toEqual(["pull", "--ignore-buildable"]);
  expect(calls[2].argv.slice(-3)).toEqual(["up", "-d", "--remove-orphans"]);

  expect(pruneCalled.value).toBe(true);
});

test("runUpdate fails fast when compose file missing", async () => {
  const dir = makeInstallDir(false, false);
  const { deps } = makeDeps();

  await expect(runUpdate(dir, deps)).rejects.toThrow(/no arrstack install found/);
});

test("runUpdate does not fail when image prune fails", async () => {
  const dir = makeInstallDir();
  const { deps } = makeDeps({
    pruneImages: async () => ({ ok: false, message: "docker daemon busy" }),
  });

  await silently(() => runUpdate(dir, deps));

  const contents = readFileSync(join(dir, "update.log"), "utf-8");
  expect(contents).toContain("image prune failed");
});

test("runUpdate logs warning and continues when a service health check fails", async () => {
  const dir = makeInstallDir();
  const { deps } = makeDeps({ checkHealth: async () => false });

  await silently(() => runUpdate(dir, deps));

  const contents = readFileSync(join(dir, "update.log"), "utf-8");
  expect(contents).toContain("did not become healthy");
});

test("runUpdate summary reports changed service images", async () => {
  const dir = makeInstallDir();
  let captureCount = 0;
  const { deps } = makeDeps({
    captureImages: async () => {
      captureCount += 1;
      if (captureCount === 1) return new Map([["sonarr", "sha256:oldoldoldoldold"]]);
      return new Map([["sonarr", "sha256:newnewnewnewnew"]]);
    },
  });

  await silently(() => runUpdate(dir, deps));

  const contents = readFileSync(join(dir, "update.log"), "utf-8");
  expect(contents).toContain("sonarr:");
  expect(contents).toContain("oldoldoldold");
  expect(contents).toContain("newnewnewnew");
});
