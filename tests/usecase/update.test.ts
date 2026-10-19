import { test, expect, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runUpdate, type UpdateDeps } from "../../src/usecase/update.js";
import { writeState, readState } from "../../src/state/store.js";
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
    seedArrAdmin: async () => "exists",
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

test("runUpdate injects the deunhealth sidecar into an existing VPN install's compose", async () => {
  // Simulates a v1.1.0 VPN install whose state.json predates the reboot fix:
  // services_enabled has qbittorrent + gluetun but no deunhealth. `arrstack
  // update` must add the watcher so existing users get the fix without a fresh
  // install. mullvad + a real key means resolveVpnWireguardKey makes no API call.
  const dir = makeInstallDir(true, false);
  writeState(dir, {
    ...VALID_STATE,
    install_dir: dir,
    services_enabled: ["gluetun", "qbittorrent", "sonarr"],
    vpn: {
      enabled: true,
      provider: "mullvad",
      type: "wireguard",
      private_key: "KEY==",
      addresses: "10.0.0.2/32",
    },
  });
  const { deps } = makeDeps();

  await silently(() => runUpdate(dir, deps));

  const compose = readFileSync(join(dir, "docker-compose.yml"), "utf-8");
  expect(compose).toContain("deunhealth:");
  expect(compose).toContain("deunhealth.restart.on.unhealthy=true");
  const logTxt = readFileSync(join(dir, "update.log"), "utf-8");
  expect(logTxt).toContain("adding deunhealth sidecar");
  // state.json must be updated too, so doctor can verify the sidecar and a
  // later update doesn't re-add/re-log it (compose/state drift).
  expect(readState(dir)?.services_enabled).toContain("deunhealth");
});

test("runUpdate does not re-add deunhealth when it's already in services_enabled", async () => {
  const dir = makeInstallDir(true, false);
  writeState(dir, {
    ...VALID_STATE,
    install_dir: dir,
    services_enabled: ["gluetun", "qbittorrent", "deunhealth"],
    vpn: { enabled: true, provider: "mullvad", type: "wireguard", private_key: "K==", addresses: "10.0.0.2/32" },
  });
  const { deps } = makeDeps();

  await silently(() => runUpdate(dir, deps));

  const logTxt = readFileSync(join(dir, "update.log"), "utf-8");
  expect(logTxt).not.toContain("adding deunhealth sidecar");
});

test("runUpdate attempts the Bazarr Provider Hub wiring when bazarr is enabled", async () => {
  const dir = makeInstallDir(true, false);
  writeState(dir, { ...VALID_STATE, install_dir: dir, services_enabled: ["sonarr", "bazarr", "flaresolverr"] });
  const origFetch = globalThis.fetch;
  // Fake a reachable-but-empty Provider Hub so the wiring runs fast instead of
  // backing off (withRetry) against an unreachable Bazarr+.
  globalThis.fetch = (async (url: any) => {
    const u = String(url);
    if (u.endsWith("/provider-hub/catalog")) return new Response(JSON.stringify({ entries: [] }), { status: 200 });
    if (u.endsWith("/provider-hub/providers")) return new Response(JSON.stringify({ data: [] }), { status: 200 });
    return new Response("{}", { status: 200 });
  }) as any;
  try {
    const { deps } = makeDeps();
    await silently(() => runUpdate(dir, deps));
  } finally {
    globalThis.fetch = origFetch;
  }
  const logTxt = readFileSync(join(dir, "update.log"), "utf-8");
  expect(logTxt.toLowerCase()).toContain("provider hub");
});

test("runUpdate seeds arr admin credentials from admin.txt after a failed install", async () => {
  // Regression for #6: an install that aborts at docker compose pull leaves the
  // arr containers running with no user in SQLite, so the admin.txt password is
  // rejected. update must seed it on the next run.
  const dir = makeInstallDir();
  writeFileSync(join(dir, "admin.txt"), "username: admin\npassword: s3cret-pw\ngenerated: now\n");
  const calls: any[] = [];
  const { deps } = makeDeps({
    seedArrAdmin: async (opts) => {
      calls.push(opts);
      return "seeded";
    },
  });

  await silently(() => runUpdate(dir, deps));

  expect(calls).toHaveLength(1);
  expect(calls[0].username).toBe("admin");
  expect(calls[0].password).toBe("s3cret-pw");
  expect(calls[0].baseUrl).toBe("http://localhost:8989");
  expect(calls[0].apiVersion).toBe("v3");
  const logTxt = readFileSync(join(dir, "update.log"), "utf-8");
  expect(logTxt).toContain("sonarr: seeded admin credentials");
});

test("runUpdate skips arr admin seeding when admin.txt is missing", async () => {
  const dir = makeInstallDir();
  let called = false;
  const { deps } = makeDeps({
    seedArrAdmin: async () => {
      called = true;
      return "seeded";
    },
  });

  await silently(() => runUpdate(dir, deps));

  expect(called).toBe(false);
  const logTxt = readFileSync(join(dir, "update.log"), "utf-8");
  expect(logTxt).toContain("admin.txt missing or unreadable");
});

test("runUpdate logs a warning and continues when arr admin seeding fails", async () => {
  const dir = makeInstallDir();
  writeFileSync(join(dir, "admin.txt"), "username: admin\npassword: pw\ngenerated: now\n");
  const { deps } = makeDeps({
    seedArrAdmin: async () => {
      throw new Error("HTTP 500");
    },
  });

  await silently(() => runUpdate(dir, deps));

  const logTxt = readFileSync(join(dir, "update.log"), "utf-8");
  expect(logTxt).toContain("warning: could not verify sonarr admin login");
  expect(logTxt).toContain("done.");
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
