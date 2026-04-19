import { existsSync, openSync, writeSync, closeSync, fsyncSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readState } from "../state/store.js";
import { exec } from "../lib/exec.js";
import { getServicesByIds } from "../catalog/index.js";
import type { Service } from "../catalog/schema.js";
import type { State } from "../state/schema.js";
import { renderCaddyfile } from "../renderer/caddy.js";
import { renderCompose } from "../renderer/compose.js";

export interface UpdateDeps {
  runStreaming: (argv: string[], onLine: (line: string) => void) => Promise<{ ok: boolean; code: number | null }>;
  captureImages: (composeFile: string) => Promise<Map<string, string>>;
  pruneImages: () => Promise<{ ok: boolean; message: string }>;
  checkHealth: (url: string, timeoutMs: number) => Promise<boolean>;
  now: () => number;
}

interface UpdateSummary {
  serviceId: string;
  before: string;
  after: string;
  changed: boolean;
}

export async function runUpdate(installDir: string, deps?: Partial<UpdateDeps>): Promise<void> {
  const composeFile = join(installDir, "docker-compose.yml");
  if (!existsSync(composeFile)) {
    throw new Error(`no arrstack install found at ${installDir}`);
  }

  const state = readState(installDir);
  if (!state) {
    throw new Error(`No state.json found in ${installDir}. Run 'arrstack install' first.`);
  }

  const d: UpdateDeps = {
    runStreaming: deps?.runStreaming ?? defaultRunStreaming,
    captureImages: deps?.captureImages ?? defaultCaptureImages,
    pruneImages: deps?.pruneImages ?? defaultPruneImages,
    checkHealth: deps?.checkHealth ?? defaultCheckHealth,
    now: deps?.now ?? Date.now,
  };

  const logPath = join(installDir, "update.log");
  const fd = openSync(logPath, "a", 0o644);
  const writeLine = (line: string): void => {
    const stamped = `${new Date().toISOString()} ${line}\n`;
    writeSync(fd, stamped);
  };
  const logAndEcho = (line: string): void => {
    writeLine(line);
    console.log(line);
  };

  const totalStart = d.now();
  const phaseTimes: Record<string, number> = {};
  let summary: UpdateSummary[] = [];

  try {
    logAndEcho(`[update] starting update in ${installDir}`);

    const captureBeforeStart = d.now();
    logAndEcho("[update] capturing current image IDs");
    const before = await d.captureImages(composeFile);
    phaseTimes["capture-before"] = d.now() - captureBeforeStart;

    // Regenerate installer-owned config files from the templates shipped with
    // the CURRENT binary. Without this, a Caddyfile/compose.yml bug fixed in a
    // newer installer version stays baked into the user's install dir forever
    // — `arrstack update` would pull new images but Caddy would still serve
    // the old config. State-derived files are deterministic, so rewriting is
    // safe; the .env (which holds secrets like admin password / encryption
    // key) is intentionally left alone.
    const renderStart = d.now();
    logAndEcho("[update] rendering docker-compose.yml + Caddyfile from current templates");
    regenerateInstallerConfig(installDir, state, logAndEcho);
    phaseTimes["render-config"] = d.now() - renderStart;

    const buildStart = d.now();
    logAndEcho("[update] docker compose build");
    const build = await d.runStreaming(
      ["docker", "compose", "-f", composeFile, "build", "--pull"],
      (line) => {
        writeLine(line);
        process.stdout.write(`${line}\n`);
      }
    );
    phaseTimes["build"] = d.now() - buildStart;
    if (!build.ok) {
      throw new Error(`docker compose build failed (exit ${build.code})`);
    }

    const pullStart = d.now();
    logAndEcho("[update] docker compose pull --ignore-buildable");
    const pull = await d.runStreaming(
      ["docker", "compose", "-f", composeFile, "pull", "--ignore-buildable"],
      (line) => {
        writeLine(line);
        process.stdout.write(`${line}\n`);
      }
    );
    phaseTimes["pull"] = d.now() - pullStart;
    if (!pull.ok) {
      throw new Error(`docker compose pull failed (exit ${pull.code})`);
    }

    const upStart = d.now();
    logAndEcho("[update] docker compose up -d --remove-orphans");
    const up = await d.runStreaming(
      ["docker", "compose", "-f", composeFile, "up", "-d", "--remove-orphans"],
      (line) => {
        writeLine(line);
        process.stdout.write(`${line}\n`);
      }
    );
    phaseTimes["up"] = d.now() - upStart;
    if (!up.ok) {
      throw new Error(`docker compose up failed (exit ${up.code})`);
    }

    const healthStart = d.now();
    const services = getServicesByIds(state.services_enabled);
    await runHealthChecks(services, d.checkHealth, logAndEcho);
    phaseTimes["health"] = d.now() - healthStart;

    const captureAfterStart = d.now();
    const after = await d.captureImages(composeFile);
    phaseTimes["capture-after"] = d.now() - captureAfterStart;
    summary = diffImages(before, after);

    const pruneStart = d.now();
    logAndEcho("[update] docker image prune -f");
    const prune = await d.pruneImages();
    phaseTimes["prune"] = d.now() - pruneStart;
    if (!prune.ok) {
      logAndEcho(`[update] warning: image prune failed: ${prune.message}`);
    } else if (prune.message) {
      writeLine(prune.message);
    }

    const total = d.now() - totalStart;
    logAndEcho("[update] summary");
    const updated = summary.filter((s) => s.changed);
    if (updated.length === 0) {
      logAndEcho("[update]   no service images changed");
    } else {
      for (const s of updated) {
        logAndEcho(`[update]   ${s.serviceId}: ${shortId(s.before)} -> ${shortId(s.after)}`);
      }
    }
    for (const [phase, ms] of Object.entries(phaseTimes)) {
      logAndEcho(`[update]   phase ${phase}: ${ms}ms`);
    }
    logAndEcho(`[update]   total: ${total}ms`);
    logAndEcho("[update] done. Run 'arrstack doctor' to verify.");
  } finally {
    try { fsyncSync(fd); } catch { /* ignore */ }
    closeSync(fd);
  }
}

function regenerateInstallerConfig(
  installDir: string,
  state: State,
  log: (line: string) => void
): void {
  const services = getServicesByIds(state.services_enabled);

  const composePath = join(installDir, "docker-compose.yml");
  const composeContent = renderCompose(services, {
    installDir,
    storageRoot: state.storage_root,
    extraPaths: state.extra_paths,
    puid: state.puid,
    pgid: state.pgid,
    timezone: state.timezone,
    apiKeys: state.api_keys,
    gpu: state.gpu,
    vpn: state.vpn,
    remoteMode: state.remote_access.mode,
  });
  writeFileSync(composePath, composeContent);
  log(`[update]   wrote ${composePath}`);

  const caddyfilePath = join(installDir, "Caddyfile");
  const caddyContent = renderCaddyfile(services, {
    mode: state.remote_access.mode,
    domain: state.remote_access.domain,
    localDns: state.local_dns,
  });
  writeFileSync(caddyfilePath, caddyContent);
  log(`[update]   wrote ${caddyfilePath}`);
}

async function runHealthChecks(
  services: Service[],
  checkHealth: UpdateDeps["checkHealth"],
  log: (line: string) => void
): Promise<void> {
  const httpServices = services.filter((s) => s.health?.type === "http");
  if (httpServices.length === 0) return;
  log(`[update] health-checking ${httpServices.length} service(s)`);
  await Promise.all(
    httpServices.map(async (svc) => {
      const health = svc.health!;
      const url = `http://localhost:${health.port}${health.path ?? "/"}`;
      const ok = await checkHealth(url, 60_000);
      if (ok) {
        log(`[update]   ${svc.id}: healthy (${url})`);
      } else {
        log(`[update]   warning: ${svc.id} did not become healthy at ${url}; continuing`);
      }
    })
  );
}

function diffImages(before: Map<string, string>, after: Map<string, string>): UpdateSummary[] {
  const ids = new Set<string>([...before.keys(), ...after.keys()]);
  const out: UpdateSummary[] = [];
  for (const id of ids) {
    const b = before.get(id) ?? "";
    const a = after.get(id) ?? "";
    out.push({ serviceId: id, before: b, after: a, changed: b !== a });
  }
  out.sort((x, y) => x.serviceId.localeCompare(y.serviceId));
  return out;
}

function shortId(id: string): string {
  if (!id) return "(none)";
  const stripped = id.startsWith("sha256:") ? id.slice(7) : id;
  return stripped.slice(0, 12);
}

async function defaultRunStreaming(
  argv: string[],
  onLine: (line: string) => void
): Promise<{ ok: boolean; code: number | null }> {
  const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe" });

  const pump = async (stream: ReadableStream<Uint8Array> | null): Promise<void> => {
    if (!stream) return;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
        if (line.length > 0) onLine(line);
      }
    }
    buf += decoder.decode();
    if (buf.length > 0) onLine(buf.replace(/\r$/, ""));
  };

  await Promise.all([pump(proc.stdout as any), pump(proc.stderr as any)]);
  const code = await proc.exited;
  return { ok: code === 0, code };
}

async function defaultCaptureImages(composeFile: string): Promise<Map<string, string>> {
  const result = await exec(
    ["docker", "compose", "-f", composeFile, "images", "--format", "json"],
    { timeoutMs: 30_000 }
  );
  const out = new Map<string, string>();
  if (!result.ok) return out;
  const text = result.stdout.trim();
  if (!text) return out;

  const rows = parseComposeImagesJson(text);
  for (const row of rows) {
    if (!row.Service) continue;
    out.set(row.Service, row.ID ?? "");
  }
  return out;
}

interface ComposeImageRow {
  Service?: string;
  ID?: string;
}

function parseComposeImagesJson(text: string): ComposeImageRow[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as ComposeImageRow[];
  } catch { /* fall through to ndjson */ }
  const rows: ComposeImageRow[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed) as ComposeImageRow);
    } catch { /* skip */ }
  }
  return rows;
}

async function defaultPruneImages(): Promise<{ ok: boolean; message: string }> {
  const result = await exec(["docker", "image", "prune", "-f"], { timeoutMs: 120_000 });
  if (result.ok) return { ok: true, message: result.stdout };
  return { ok: false, message: result.stderr };
}

async function defaultCheckHealth(url: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (r.ok || r.status < 500) return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}
