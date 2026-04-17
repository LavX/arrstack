import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type { State } from "../state/schema.js";
import type { Logger } from "../lib/log.js";
import { createLogger } from "../lib/log.js";
import { exec } from "../lib/exec.js";
import { createStorageLayout } from "../storage/layout.js";
import { generateApiKey } from "../lib/random.js";
import { bcryptHash, qbitPbkdf2Hash } from "../auth/hash.js";
import { renderEnvFile } from "../renderer/env.js";
import { renderCompose } from "../renderer/compose.js";
import { renderCaddyfile } from "../renderer/caddy.js";
import { renderServarrConfig } from "../renderer/servarr-config.js";
import { renderBazarrConfig } from "../renderer/bazarr-config.js";
import { renderQbitConfig } from "../renderer/qbit-config.js";
import { renderRecyclarrConfig } from "../renderer/recyclarr-config.js";
import { renderJellyfinEncoding } from "../renderer/jellyfin-encoding.js";
import { renderFirstRun } from "../renderer/first-run.js";
import { renderDnsmasqConf } from "../renderer/dnsmasq.js";
import { getServicesByIds } from "../catalog/index.js";
import { writeState } from "../state/store.js";

export type StepStatus = "pending" | "running" | "done" | "failed";
export interface StepUpdate {
  step: string;
  status: StepStatus;
  message?: string;
  durationMs?: number;
}

export interface InstallResult {
  urls: Array<{ name: string; url: string; description: string }>;
  password: string;
  adminUser: string;
}

async function runStep(
  name: string,
  onStep: (u: StepUpdate) => void,
  log: Logger,
  fn: () => Promise<void>
): Promise<void> {
  onStep({ step: name, status: "running" });
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    log.info(name, `completed in ${ms}ms`);
    onStep({ step: name, status: "done", durationMs: ms });
  } catch (err: any) {
    log.error(name, err.message ?? String(err));
    onStep({ step: name, status: "failed", message: err.message ?? String(err) });
    throw err;
  }
}

export async function waitForHealth(
  service: string,
  port: number,
  path: string,
  timeoutMs: number,
  installDir: string
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`http://localhost:${port}${path}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const logs = await exec(
    `docker compose -f ${installDir}/docker-compose.yml logs --tail=50 ${service}`
  );
  throw new Error(
    `${service} did not become healthy within ${timeoutMs / 1000}s.\nLast logs:\n${
      logs.ok ? logs.stdout.slice(-1000) : "unavailable"
    }`
  );
}

export async function getHostIp(): Promise<string> {
  const r = await exec("hostname -I");
  return r.ok ? r.stdout.trim().split(" ")[0] : "localhost";
}

export async function runInstall(
  state: State,
  adminPassword: string,
  onStep: (update: StepUpdate) => void
): Promise<InstallResult> {
  const installDir = state.install_dir;
  const logPath = join(installDir, "install.log");

  mkdirSync(installDir, { recursive: true });
  const log = createLogger(logPath);

  const services = getServicesByIds(state.services_enabled);

  // Mutable install-time state
  const apiKeys: Record<string, string> = { ...state.api_keys };
  let bcryptPassword = "";
  let pbkdf2Hash = "";
  let hostIp = "localhost";

  // Step 1: Create storage layout
  await runStep("Create storage layout", onStep, log, async () => {
    createStorageLayout(state.storage_root, state.puid, state.pgid);
  });

  // Step 2: Generate API keys for services that declare apiKeyEnv
  await runStep("Generate API keys", onStep, log, async () => {
    for (const svc of services) {
      if (svc.apiKeyEnv && !apiKeys[svc.id]) {
        apiKeys[svc.id] = generateApiKey();
      }
    }
  });

  // Step 3: Hash admin password
  await runStep("Hash admin password", onStep, log, async () => {
    [bcryptPassword, pbkdf2Hash] = await Promise.all([
      bcryptHash(adminPassword),
      Promise.resolve(qbitPbkdf2Hash(adminPassword)),
    ]);
  });

  // Step 4: Write .env (mode 600)
  await runStep("Write .env", onStep, log, async () => {
    const content = renderEnvFile({
      puid: state.puid,
      pgid: state.pgid,
      timezone: state.timezone,
      installDir,
      storageRoot: state.storage_root,
      adminUsername: state.admin.username,
      adminPassword,
      apiKeys,
      cfApiToken:
        state.remote_access.mode === "cloudflare"
          ? state.remote_access.token
          : undefined,
      duckdnsToken:
        state.remote_access.mode === "duckdns"
          ? state.remote_access.token
          : undefined,
    });
    writeFileSync(join(installDir, ".env"), content, { mode: 0o600 });
  });

  // Step 5: Render docker-compose.yml
  await runStep("Render docker-compose.yml", onStep, log, async () => {
    const content = renderCompose(services, {
      storageRoot: state.storage_root,
      extraPaths: state.extra_paths,
      puid: state.puid,
      pgid: state.pgid,
      timezone: state.timezone,
      apiKeys,
      gpu: state.gpu,
      vpn: state.vpn,
    });
    writeFileSync(join(installDir, "docker-compose.yml"), content);
  });

  // Step 6: Render Caddyfile
  await runStep("Render Caddyfile", onStep, log, async () => {
    const content = renderCaddyfile(services, {
      mode: state.remote_access.mode === "none" ? "none" : state.remote_access.mode,
      domain: state.remote_access.domain,
    });
    writeFileSync(join(installDir, "Caddyfile"), content);
  });

  // Step 7: Pre-write service configs
  await runStep("Pre-write service configs", onStep, log, async () => {
    const servarrIds = ["sonarr", "radarr", "prowlarr", "lidarr", "readarr"] as const;
    for (const id of servarrIds) {
      const svc = services.find((s) => s.id === id);
      if (!svc) continue;
      const configDir = join(installDir, "config", id);
      mkdirSync(configDir, { recursive: true });
      const xml = renderServarrConfig({ apiKey: apiKeys[id] ?? generateApiKey() });
      writeFileSync(join(configDir, "config.xml"), xml);
    }

    const bazarrSvc = services.find((s) => s.id === "bazarr");
    if (bazarrSvc) {
      const configDir = join(installDir, "config", "bazarr");
      mkdirSync(configDir, { recursive: true });
      const yaml = renderBazarrConfig({
        username: state.admin.username,
        bcryptPassword,
        sonarrApiKey: apiKeys["sonarr"] ?? "",
        radarrApiKey: apiKeys["radarr"] ?? "",
      });
      writeFileSync(join(configDir, "config.yaml"), yaml);
    }

    const qbitSvc = services.find((s) => s.id === "qbittorrent");
    if (qbitSvc) {
      const configDir = join(installDir, "config", "qbittorrent");
      mkdirSync(configDir, { recursive: true });
      const conf = renderQbitConfig({
        username: state.admin.username,
        pbkdf2Hash,
      });
      writeFileSync(join(configDir, "qBittorrent.conf"), conf);
    }

    const recyclarrSvc = services.find((s) => s.id === "recyclarr");
    if (recyclarrSvc) {
      const configDir = join(installDir, "config", "recyclarr");
      mkdirSync(configDir, { recursive: true });
      const yml = renderRecyclarrConfig({
        sonarrApiKey: apiKeys["sonarr"] ?? "",
        radarrApiKey: apiKeys["radarr"] ?? "",
      });
      writeFileSync(join(configDir, "recyclarr.yml"), yml);
    }

    const jellyfinSvc = services.find((s) => s.id === "jellyfin");
    if (jellyfinSvc) {
      const configDir = join(installDir, "config", "jellyfin");
      mkdirSync(configDir, { recursive: true });
      const xml = renderJellyfinEncoding({
        vendor: state.gpu.vendor,
        deviceName: state.gpu.device_name,
      });
      writeFileSync(join(configDir, "encoding.xml"), xml);
    }
  });

  // Step 8: If local DNS enabled, render dnsmasq.conf
  if (state.local_dns.enabled) {
    await runStep("Render dnsmasq.conf", onStep, log, async () => {
      hostIp = await getHostIp();
      const content = renderDnsmasqConf({
        tld: state.local_dns.tld,
        hostIp,
      });
      const configDir = join(installDir, "config", "dnsmasq");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "dnsmasq.conf"), content);
    });
  } else {
    hostIp = await getHostIp();
  }

  // Step 9: docker compose pull (timeout 10 min)
  await runStep("docker compose pull", onStep, log, async () => {
    const result = await exec(`docker compose -f ${join(installDir, "docker-compose.yml")} pull`, {
      timeoutMs: 600_000,
    });
    if (!result.ok) {
      throw new Error(`docker compose pull failed: ${result.stderr}`);
    }
  });

  // Step 10: docker compose up -d (timeout 2 min)
  await runStep("docker compose up", onStep, log, async () => {
    const result = await exec(
      `docker compose -f ${join(installDir, "docker-compose.yml")} up -d`,
      { timeoutMs: 120_000 }
    );
    if (!result.ok) {
      throw new Error(`docker compose up failed: ${result.stderr}`);
    }
  });

  // Step 11: Health gate
  await runStep("Wait for services", onStep, log, async () => {
    const healthChecks = services.filter(
      (svc) => svc.health && svc.health.type === "http"
    );
    for (const svc of healthChecks) {
      const health = svc.health!;
      await waitForHealth(svc.id, health.port, health.path ?? "/", 180_000, installDir);
    }
  });

  // Step 12: Integration wiring (Phase 9)
  // TODO: wire in Phase 9 integration task
  // await configureProwlarrIndexers(state, apiKeys, installDir);
  // await registerApps(state, apiKeys, installDir);
  // await configureSonarr(state, apiKeys, installDir);
  // await configureRadarr(state, apiKeys, installDir);
  // await configureQbittorrent(state, adminPassword, installDir);
  // await setupJellyfin(state, adminPassword, installDir);
  // await linkJellyseerr(state, apiKeys, installDir);
  // await syncRecyclarr(state, installDir);

  // Step 13: Generate FIRST-RUN.md
  await runStep("Write FIRST-RUN.md", onStep, log, async () => {
    const content = renderFirstRun({
      services,
      hostIp,
      adminUsername: state.admin.username,
    });
    writeFileSync(join(installDir, "FIRST-RUN.md"), content);
  });

  // Step 14: Write admin.txt (mode 600)
  await runStep("Write admin.txt", onStep, log, async () => {
    const lines = [
      `username: ${state.admin.username}`,
      `password: ${adminPassword}`,
      `generated: ${new Date().toISOString()}`,
      "",
    ].join("\n");
    writeFileSync(join(installDir, "admin.txt"), lines, { mode: 0o600 });
  });

  // Step 15: Write final state
  await runStep("Write state", onStep, log, async () => {
    const finalState: State = {
      ...state,
      api_keys: apiKeys,
      install_completed_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    };
    writeState(installDir, finalState);
  });

  // Build result URLs
  const urls: Array<{ name: string; url: string; description: string }> = services
    .filter((svc) => svc.adminPort !== undefined)
    .map((svc) => ({
      name: svc.name,
      url: `http://${hostIp}:${svc.adminPort}`,
      description: svc.description,
    }));

  return {
    urls,
    password: adminPassword,
    adminUser: state.admin.username,
  };
}
