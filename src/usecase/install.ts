import { writeFileSync, mkdirSync, chownSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

import type { State } from "../state/schema.js";
import type { Logger } from "../lib/log.js";
import { createLogger } from "../lib/log.js";
import { exec } from "../lib/exec.js";
import { createStorageLayout } from "../storage/layout.js";
import { generateApiKey } from "../lib/random.js";
import { bcryptHash, qbitPbkdf2Hash, bazarrPbkdf2Hash } from "../auth/hash.js";
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
import { addProwlarrIndexers } from "../wiring/prowlarr-indexers.js";
import { registerProwlarrApps } from "../wiring/prowlarr-apps.js";
import {
  configureProwlarrFlaresolverr,
  tagExistingProwlarrIndexers,
  repushProwlarrIndexersToApps,
} from "../wiring/prowlarr-flaresolverr.js";
import { linkJellyseerrToArrs } from "../wiring/jellyseerr-arr.js";
import { seedArrAdmin } from "../wiring/arr-auth.js";
import { configureTrailarr } from "../wiring/trailarr.js";
import { configureArr } from "../wiring/sonarr-radarr.js";
import { configureQbit } from "../wiring/qbittorrent.js";
import { setupJellyfin } from "../wiring/jellyfin.js";
import { linkJellyseerr } from "../wiring/jellyseerr.js";
import { configureBazarrLanguages } from "../wiring/bazarr.js";
import { runRecyclarrSync } from "../wiring/recyclarr.js";

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
  const logs = await exec([
    "docker", "compose", "-f", `${installDir}/docker-compose.yml`,
    "logs", "--tail=200", service,
  ]);
  const tail = logs.ok ? logs.stdout : "unavailable";
  throw new Error(
    `${service} did not become healthy within ${timeoutMs / 1000}s.\n` +
    `Last logs (last 200 lines):\n${tail}\n` +
    `Full logs: docker compose -f ${installDir}/docker-compose.yml logs ${service}\n` +
    `Install log: ${installDir}/install.log`
  );
}

export async function getHostIp(): Promise<string> {
  const r = await exec(["hostname", "-I"]);
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
  let bazarrHash = "";
  let hostIp = "localhost";
  // Generated once, shared between the .env (-> ai-subtitle-translator) and
  // Bazarr's config.yaml so AES-GCM encryption between the two matches.
  const translatorEncryptionKey = randomBytes(32).toString("hex");

  // Step 1: Create storage layout (primary root + tv/movies subdirs inside each
  // extra path so reconfigures that add drives also get their layout).
  await runStep("Create storage layout", onStep, log, async () => {
    createStorageLayout(state.storage_root, state.puid, state.pgid, state.extra_paths);
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
    bazarrHash = bazarrPbkdf2Hash(adminPassword);
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
      encryptionKey: translatorEncryptionKey,
    });
    writeFileSync(join(installDir, ".env"), content, { mode: 0o600 });
  });

  // Step 5: Render docker-compose.yml
  await runStep("Render docker-compose.yml", onStep, log, async () => {
    const content = renderCompose(services, {
      installDir,
      storageRoot: state.storage_root,
      extraPaths: state.extra_paths,
      puid: state.puid,
      pgid: state.pgid,
      timezone: state.timezone,
      apiKeys,
      gpu: state.gpu,
      vpn: state.vpn,
      remoteMode: state.remote_access.mode,
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
    // Pre-create every enabled service's config dir owned by PUID/PGID so
    // containers running as that uid can write into their bind mount. If
    // Docker auto-creates the dir instead, it lands as root:root and the
    // container hits EACCES on first write (e.g. jellyseerr logs).
    for (const svc of services) {
      const configDir = join(installDir, "config", svc.id);
      mkdirSync(configDir, { recursive: true });
      try { chownSync(configDir, state.puid, state.pgid); } catch { /* non-root */ }
    }

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
      // Bazarr reads its config from $CONFIG_DIR/config/config.yaml (note the
      // nested config/ dir — see bazarr/app/config.py:507). Our bind mount is
      // installDir/config/bazarr -> /config inside the container, so on the
      // host we need to write to installDir/config/bazarr/config/config.yaml.
      const bazarrConfigDir = join(installDir, "config", "bazarr", "config");
      mkdirSync(bazarrConfigDir, { recursive: true });
      // Generate Bazarr's own API key once and keep it in apiKeys so both the
      // config.yaml and the post-install wiring call (configureBazarrLanguages)
      // use the same value.
      if (!apiKeys["bazarr"]) apiKeys["bazarr"] = generateApiKey();
      const yaml = renderBazarrConfig({
        username: state.admin.username,
        passwordHash: bazarrHash,
        bazarrApiKey: apiKeys["bazarr"],
        flaskSecretKey: generateApiKey(),
        sonarrApiKey: apiKeys["sonarr"] ?? "",
        radarrApiKey: apiKeys["radarr"] ?? "",
        translatorEncryptionKey,
      });
      writeFileSync(join(bazarrConfigDir, "config.yaml"), yaml);
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
        // state.gpu.device_name is the lspci string (e.g. "Intel ... Iris Xe"),
        // not a /dev path, so do not pass it as devicePath. Default (renderD128)
        // is the right answer for single-GPU hosts.
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
    const result = await exec(
      ["docker", "compose", "-f", join(installDir, "docker-compose.yml"), "pull"],
      { timeoutMs: 600_000 }
    );
    if (!result.ok) {
      throw new Error(`docker compose pull failed: ${result.stderr}`);
    }
  });

  // Step 10: docker compose up -d (timeout 2 min)
  await runStep("docker compose up", onStep, log, async () => {
    const result = await exec(
      ["docker", "compose", "-f", join(installDir, "docker-compose.yml"), "up", "-d"],
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
  const has = (id: string) => state.services_enabled.includes(id);

  const extraMediaPaths = (kind: "movies" | "tv") =>
    state.extra_paths.map((_, i) => `/data/extra-${i}/${kind === "tv" ? "tv" : "movies"}`);

  // Step 12a: Jellyfin setup (must be first, Jellyseerr depends on it)
  if (has("jellyfin")) {
    await runStep("Setting up Jellyfin admin and libraries", onStep, log, async () => {
      const libs = [
        { name: "Movies", type: "movies", paths: ["/data/media/movies", ...extraMediaPaths("movies")] },
        { name: "TV Shows", type: "tvshows", paths: ["/data/media/tv", ...extraMediaPaths("tv")] },
        { name: "Music", type: "music", paths: ["/data/media/music"] },
      ];
      await setupJellyfin(state.admin.username, adminPassword, libs);
    });
  }

  // Step 12b: Jellyseerr (depends on Jellyfin). The /auth/jellyfin bootstrap
  // also persists the Jellyfin connection to Jellyseerr's settings.
  if (has("jellyseerr")) {
    await runStep("Linking Jellyseerr to Jellyfin", onStep, log, async () => {
      await linkJellyseerr(state.admin.username, adminPassword);
    });
  }

  // Step 12b3: Jellyseerr to Sonarr/Radarr (run AFTER the arr apps are wired
  // so the activeProfileId=1 and activeDirectory exist on the arr side).
  // Moved to run after Sonarr/Radarr configuration below.

  // Step 12b2: Bazarr languages + default profile
  if (has("bazarr")) {
    await runStep("Configuring Bazarr languages and profile", onStep, log, async () => {
      await configureBazarrLanguages({
        apiKey: apiKeys["bazarr"] ?? "",
        languages: state.subtitle_languages,
      });
    });
  }

  // Step 12c: qBittorrent categories + settings
  if (has("qbittorrent")) {
    await runStep("Configuring qBittorrent categories and settings", onStep, log, async () => {
      await configureQbit(state.admin.username, adminPassword);
    });
  }

  // Step 12c2: Seed admin credentials on each arr app. Sonarr/Radarr/Prowlarr
  // store users in SQLite, so the config.xml preset alone doesn't pre-create
  // an account. PUT /api/v{N}/config/host with username/password does.
  for (const { id, port, version } of [
    { id: "prowlarr", port: 9696, version: "v1" as const },
    { id: "sonarr", port: 8989, version: "v3" as const },
    { id: "radarr", port: 7878, version: "v3" as const },
  ]) {
    if (!has(id)) continue;
    await runStep(`Seeding ${id} admin credentials`, onStep, log, async () => {
      await seedArrAdmin({
        apiKey: apiKeys[id] ?? "",
        username: state.admin.username,
        password: adminPassword,
        baseUrl: `http://localhost:${port}`,
        apiVersion: version,
      });
    });
  }

  // Step 12d: Prowlarr wiring
  // Order matters: apps FIRST, then indexers. Prowlarr auto-pushes an indexer
  // to every registered app at creation time; doing the reverse means the
  // indexer-push fires against zero apps and ApplicationIndexerSync does not
  // re-push existing indexers. FlareSolverr must also be wired before
  // indexers so Cloudflare-gated trackers can actually be probed.
  if (has("prowlarr")) {
    // Register Sonarr/Radarr first so subsequent indexer creations auto-push.
    await runStep("Registering Sonarr and Radarr in Prowlarr", onStep, log, async () => {
      await registerProwlarrApps(apiKeys.prowlarr, apiKeys.sonarr ?? "", apiKeys.radarr ?? "");
    });

    // Wire FlareSolverr so CF-gated trackers can be probed. The tag id
    // returned here is stamped into every indexer we add next — the tag
    // must be on the indexer at CREATE time or Prowlarr's first test fires
    // without the proxy, fails to CloudFlare, and sticks the indexer into
    // a cooldown that a later PUT cannot clear.
    let flaresolverrTagId: number | undefined;
    if (has("flaresolverr")) {
      await runStep("Wiring FlareSolverr into Prowlarr", onStep, log, async () => {
        flaresolverrTagId = await configureProwlarrFlaresolverr({ apiKey: apiKeys.prowlarr });
        // Tag any indexers left over from a previous install as well —
        // they can't retroactively shed the cooldown but they'll use the
        // proxy on next scheduled refresh.
        if (flaresolverrTagId !== undefined) {
          await tagExistingProwlarrIndexers(apiKeys.prowlarr, flaresolverrTagId);
        }
      });
    }

    // Now add indexers — each one is born with the FlareSolverr tag so the
    // first test already routes through the proxy, and auto-push to the
    // arr apps fires on creation.
    await runStep("Adding Prowlarr public indexers", onStep, log, async () => {
      await addProwlarrIndexers(apiKeys.prowlarr, flaresolverrTagId);
    });

    // Safety net: re-PUT every indexer so any that were present before apps
    // existed (e.g. from a failed previous install) also get pushed.
    await runStep("Re-syncing Prowlarr indexers to apps", onStep, log, async () => {
      await repushProwlarrIndexersToApps(apiKeys.prowlarr);
    });
  }

  // Step 12f: Sonarr root folders + download client
  if (has("sonarr")) {
    await runStep("Configuring Sonarr root folders and download client", onStep, log, async () => {
      await configureArr("sonarr", apiKeys.sonarr, {
        rootFolder: "/data/media/tv",
        extraFolders: state.extra_paths.map((_, i) => `/data/extra-${i}/tv`),
        qbitUser: state.admin.username,
        qbitPass: adminPassword,
        category: "tv",
      });
    });
  }

  // Step 12g: Radarr root folders + download client
  if (has("radarr")) {
    await runStep("Configuring Radarr root folders and download client", onStep, log, async () => {
      await configureArr("radarr", apiKeys.radarr, {
        rootFolder: "/data/media/movies",
        extraFolders: state.extra_paths.map((_, i) => `/data/extra-${i}/movies`),
        qbitUser: state.admin.username,
        qbitPass: adminPassword,
        category: "movies",
      });
    });
  }

  // Step 12g2: Jellyseerr -> Sonarr + Radarr (after arrs have root folders &
  // quality profiles that Jellyseerr references with activeProfileId:1).
  if (has("jellyseerr") && (has("sonarr") || has("radarr"))) {
    await runStep("Linking Jellyseerr to Sonarr and Radarr", onStep, log, async () => {
      await linkJellyseerrToArrs({
        adminUser: state.admin.username,
        adminPass: adminPassword,
        sonarrApiKey: apiKeys.sonarr ?? "",
        radarrApiKey: apiKeys.radarr ?? "",
      });
    });
  }

  // Step 12g3: Trailarr login + Sonarr/Radarr connections. Runs after arrs
  // are fully configured so connection tests pass on the first try.
  if (has("trailarr") && (has("sonarr") || has("radarr"))) {
    await runStep("Linking Trailarr to Sonarr and Radarr", onStep, log, async () => {
      await configureTrailarr({
        installDir: state.install_dir,
        adminUser: state.admin.username,
        adminPass: adminPassword,
        sonarrApiKey: apiKeys.sonarr ?? "",
        radarrApiKey: apiKeys.radarr ?? "",
      });
    });
  }

  // Step 12h: Recyclarr TRaSH profiles
  if (has("recyclarr")) {
    await runStep("Applying TRaSH quality profiles via Recyclarr", onStep, log, async () => {
      await runRecyclarrSync(state.install_dir);
    });
  }

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
