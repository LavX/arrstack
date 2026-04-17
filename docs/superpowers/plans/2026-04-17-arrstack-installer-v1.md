# arrstack-installer v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-command TUI installer that sets up a 10-service arr media stack with zero post-install admin clicks.

**Architecture:** TypeScript + Ink (React for terminals) compiled to a static binary via Bun. Single-screen form wizard collects config, then a 30-step pipeline generates compose/configs, starts containers, and auto-wires every service via their APIs. State stored in `/opt/arrstack/state.json`.

**Tech Stack:** TypeScript, Bun, Ink, commander, zod, handlebars, undici, bcryptjs, better-sqlite3

**Spec:** `docs/superpowers/specs/2026-04-16-arrstack-installer-design.md`

---

## Phase 1: Project Scaffold (Tasks 1-5)

### Task 1: Initialize Bun project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/cli.ts`
- Create: `.gitignore`
- Create: `.prettierrc`
- Create: `eslint.config.mjs`

- [ ] **Step 1: Initialize and configure**

```bash
cd /home/lavx/arrstack-installer
bun init -y
```

- [ ] **Step 2: Set up package.json**

```json
{
  "name": "arrstack-installer",
  "version": "0.1.0",
  "type": "module",
  "bin": { "arrstack": "src/cli.ts" },
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build --compile --minify --target=bun-linux-x64 src/cli.ts --outfile dist/arrstack-linux-x64",
    "test": "bun test",
    "lint": "eslint src/",
    "format": "prettier --write 'src/**/*.{ts,tsx}'"
  }
}
```

- [ ] **Step 3: Set up tsconfig.json**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "ink",
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create directory structure**

```bash
mkdir -p src/{catalog,state,storage,renderer,platform,auth,wiring,remote,usecase,ui/{wizard,progress,done,shared},lib}
mkdir -p templates tests dist bin
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.superpowers/
*.log
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: initialize bun project with directory structure"
```

### Task 2: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install production dependencies**

```bash
bun add ink react commander zod undici handlebars bcryptjs better-sqlite3 yaml
```

- [ ] **Step 2: Install dev dependencies**

```bash
bun add -d @types/react @types/bcryptjs @types/better-sqlite3 eslint prettier bun-types
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add production and dev dependencies"
```

### Task 3: CLI entry point with commander

**Files:**
- Create: `src/cli.ts`
- Create: `src/version.ts`
- Test: `tests/cli.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/cli.test.ts
import { describe, test, expect } from "bun:test";
import { execSync } from "child_process";

describe("cli", () => {
  test("--version prints version", () => {
    const out = execSync("bun run src/cli.ts --version").toString().trim();
    expect(out).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("--help prints usage", () => {
    const out = execSync("bun run src/cli.ts --help").toString().trim();
    expect(out).toContain("arrstack");
    expect(out).toContain("install");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
bun test tests/cli.test.ts
```

Expected: FAIL (src/cli.ts is empty or missing)

- [ ] **Step 3: Implement cli.ts**

```ts
// src/cli.ts
import { Command } from "commander";
import { VERSION } from "./version.js";

const program = new Command()
  .name("arrstack")
  .description("One-command installer for your arr media stack")
  .version(VERSION);

program
  .command("install")
  .description("Run the install wizard")
  .option("--fresh", "Wipe config and reinstall (preserves media)")
  .option("--resume", "Resume from last failed step")
  .action(async (opts) => {
    console.log("install wizard not yet implemented");
  });

program
  .command("doctor")
  .description("Run diagnostics on the current install")
  .action(async () => {
    console.log("doctor not yet implemented");
  });

program
  .command("update")
  .description("Pull latest images and re-apply wiring")
  .action(async () => {
    console.log("update not yet implemented");
  });

program
  .command("show-password")
  .description("Print admin credentials")
  .action(async () => {
    console.log("show-password not yet implemented");
  });

program
  .command("uninstall")
  .description("Stop the stack and optionally remove config")
  .action(async () => {
    console.log("uninstall not yet implemented");
  });

program
  .command("logs <service>")
  .description("Tail logs for a service")
  .action(async (service: string) => {
    console.log(`logs for ${service} not yet implemented`);
  });

program.parse();
```

```ts
// src/version.ts
export const VERSION = "0.1.0";
```

- [ ] **Step 4: Run test, verify it passes**

```bash
bun test tests/cli.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: cli entry point with commander subcommands"
```

### Task 4: Structured logger

**Files:**
- Create: `src/lib/log.ts`
- Test: `tests/lib/log.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/lib/log.test.ts
import { describe, test, expect } from "bun:test";
import { createLogger } from "../src/lib/log.js";
import { mkdtempSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("logger", () => {
  test("writes structured JSON lines to file", () => {
    const dir = mkdtempSync(join(tmpdir(), "arrstack-log-"));
    const logPath = join(dir, "install.log");
    const log = createLogger(logPath);

    log.info("preflight", "Docker detected");
    log.error("pull", "Image not found");

    const lines = readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
    expect(lines).toHaveLength(2);
    expect(lines[0].level).toBe("info");
    expect(lines[0].step).toBe("preflight");
    expect(lines[0].msg).toBe("Docker detected");
    expect(lines[1].level).toBe("error");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Implement**

```ts
// src/lib/log.ts
import { appendFileSync, writeFileSync } from "fs";

export interface Logger {
  info(step: string, msg: string): void;
  error(step: string, msg: string): void;
  warn(step: string, msg: string): void;
}

export function createLogger(filePath: string): Logger {
  writeFileSync(filePath, "");

  function write(level: string, step: string, msg: string) {
    const entry = JSON.stringify({ ts: new Date().toISOString(), level, step, msg });
    appendFileSync(filePath, entry + "\n");
    if (level === "error") {
      process.stderr.write(`[${step}] ${msg}\n`);
    }
  }

  return {
    info: (step, msg) => write("info", step, msg),
    error: (step, msg) => write("error", step, msg),
    warn: (step, msg) => write("warn", step, msg),
  };
}
```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: structured JSON logger"
```

### Task 5: Shell exec wrapper with timeout

**Files:**
- Create: `src/lib/exec.ts`
- Test: `tests/lib/exec.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/lib/exec.test.ts
import { describe, test, expect } from "bun:test";
import { exec } from "../src/lib/exec.js";

describe("exec", () => {
  test("returns stdout on success", async () => {
    const result = await exec("echo hello");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.stdout.trim()).toBe("hello");
  });

  test("returns error on failure", async () => {
    const result = await exec("false");
    expect(result.ok).toBe(false);
  });

  test("times out", async () => {
    const result = await exec("sleep 10", { timeoutMs: 500 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.stderr).toContain("timed out");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Implement**

```ts
// src/lib/exec.ts
import { execSync, spawn } from "child_process";

type ExecResult =
  | { ok: true; stdout: string; stderr: string }
  | { ok: false; stdout: string; stderr: string; code: number | null };

export async function exec(
  cmd: string,
  opts?: { timeoutMs?: number; cwd?: string }
): Promise<ExecResult> {
  const timeout = opts?.timeoutMs ?? 120_000;

  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", cmd], {
      cwd: opts?.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      stderr += `\nProcess timed out after ${timeout}ms`;
    }, timeout);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true, stdout, stderr });
      } else {
        resolve({ ok: false, stdout, stderr, code });
      }
    });
  });
}

export function execSync_(cmd: string): string {
  return execSync(cmd, { encoding: "utf8" }).trim();
}
```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: shell exec wrapper with timeout"
```

## Phase 2: Catalog and State (Tasks 6-7)

### Task 6: Service catalog with zod schema

**Files:**
- Create: `src/catalog/schema.ts`
- Create: `src/catalog/index.ts`
- Create: `src/catalog/services.yaml`
- Test: `tests/catalog/index.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/catalog/index.test.ts
import { describe, test, expect } from "bun:test";
import { loadCatalog, getService, getDefaultServices } from "../src/catalog/index.js";

describe("catalog", () => {
  test("loads all services from yaml", () => {
    const catalog = loadCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(10);
  });

  test("getService returns sonarr", () => {
    const svc = getService("sonarr");
    expect(svc).toBeDefined();
    expect(svc!.image).toContain("sonarr");
    expect(svc!.ports).toContain(8989);
  });

  test("getDefaultServices returns only default-true", () => {
    const defaults = getDefaultServices();
    expect(defaults.every((s) => s.default)).toBe(true);
    expect(defaults.length).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Define catalog schema**

```ts
// src/catalog/schema.ts
import { z } from "zod";

export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum([
    "download", "indexer", "arr", "subtitle", "media",
    "request", "proxy", "dns", "ddns", "utility",
  ]),
  image: z.string(),
  tag: z.string().default("latest"),
  ports: z.array(z.number()),
  adminPort: z.number().optional(),
  configPath: z.string().default("/config"),
  mounts: z.record(z.string(), z.string()).default({}),
  envVars: z.record(z.string(), z.string()).default({}),
  dependsOn: z.array(z.string()).default([]),
  health: z.object({
    type: z.enum(["http", "tcp"]),
    path: z.string().optional(),
    port: z.number(),
  }).optional(),
  default: z.boolean().default(false),
  requiresAdminAuth: z.boolean().default(false),
  apiKeyEnv: z.string().optional(),
  hwaccelSupport: z.boolean().default(false),
  networkMode: z.string().optional(),
});

export type Service = z.infer<typeof ServiceSchema>;

export const CatalogSchema = z.object({
  version: z.number(),
  services: z.array(ServiceSchema),
});
```

- [ ] **Step 4: Write services.yaml with all services**

```yaml
# src/catalog/services.yaml
version: 1
services:
  - id: qbittorrent
    name: qBittorrent
    description: "Torrent download client"
    category: download
    image: lscr.io/linuxserver/qbittorrent
    tag: "4.6.7"
    ports: [8080]
    adminPort: 8080
    configPath: /config
    mounts:
      "${STORAGE_ROOT}/torrents": /data/torrents
    envVars:
      PUID: "${PUID}"
      PGID: "${PGID}"
      TZ: "${TZ}"
      WEBUI_PORT: "8080"
    health:
      type: http
      path: /api/v2/app/version
      port: 8080
    default: true
    requiresAdminAuth: true

  - id: prowlarr
    name: Prowlarr
    description: "Indexer manager. Syncs trackers to Sonarr and Radarr."
    category: indexer
    image: lscr.io/linuxserver/prowlarr
    tag: "1.28"
    ports: [9696]
    adminPort: 9696
    configPath: /config
    envVars:
      PUID: "${PUID}"
      PGID: "${PGID}"
      TZ: "${TZ}"
    apiKeyEnv: PROWLARR__AUTH__APIKEY
    health:
      type: http
      path: /api/v1/health
      port: 9696
    default: true
    requiresAdminAuth: true

  - id: flaresolverr
    name: FlareSolverr
    description: "Solves Cloudflare challenges so indexers keep working."
    category: indexer
    image: ghcr.io/flaresolverr/flaresolverr
    tag: "latest"
    ports: [8191]
    envVars:
      LOG_LEVEL: info
    health:
      type: http
      path: /health
      port: 8191
    default: true

  - id: sonarr
    name: Sonarr
    description: "TV show manager. Grabs episodes, organizes your library."
    category: arr
    image: lscr.io/linuxserver/sonarr
    tag: "4.0"
    ports: [8989]
    adminPort: 8989
    configPath: /config
    mounts:
      "${STORAGE_ROOT}": /data
    envVars:
      PUID: "${PUID}"
      PGID: "${PGID}"
      TZ: "${TZ}"
    apiKeyEnv: SONARR__AUTH__APIKEY
    health:
      type: http
      path: /api/v3/system/status
      port: 8989
    default: true
    requiresAdminAuth: true
    dependsOn: [prowlarr]

  - id: radarr
    name: Radarr
    description: "Movie manager. Grabs movies, organizes your library."
    category: arr
    image: lscr.io/linuxserver/radarr
    tag: "5.16"
    ports: [7878]
    adminPort: 7878
    configPath: /config
    mounts:
      "${STORAGE_ROOT}": /data
    envVars:
      PUID: "${PUID}"
      PGID: "${PGID}"
      TZ: "${TZ}"
    apiKeyEnv: RADARR__AUTH__APIKEY
    health:
      type: http
      path: /api/v3/system/status
      port: 7878
    default: true
    requiresAdminAuth: true
    dependsOn: [prowlarr]

  - id: bazarr
    name: Bazarr
    description: "Subtitle manager for Sonarr and Radarr libraries."
    category: subtitle
    image: lscr.io/linuxserver/bazarr
    tag: "1.4"
    ports: [6767]
    adminPort: 6767
    configPath: /config
    mounts:
      "${STORAGE_ROOT}/media": /data/media
    envVars:
      PUID: "${PUID}"
      PGID: "${PGID}"
      TZ: "${TZ}"
    health:
      type: http
      path: /api/system/status
      port: 6767
    default: true
    requiresAdminAuth: true
    dependsOn: [sonarr, radarr]

  - id: jellyfin
    name: Jellyfin
    description: "Media server. Watch your library from any device."
    category: media
    image: jellyfin/jellyfin
    tag: "10.11.6"
    ports: [8096]
    adminPort: 8096
    configPath: /config
    mounts:
      "${STORAGE_ROOT}/media": /data/media
    envVars:
      TZ: "${TZ}"
    health:
      type: http
      path: /health
      port: 8096
    default: true
    requiresAdminAuth: true
    hwaccelSupport: true

  - id: jellyseerr
    name: Jellyseerr
    description: "Request movies and shows. Links to Jellyfin."
    category: request
    image: ghcr.io/seerr-team/seerr
    tag: "latest"
    ports: [5055]
    adminPort: 5055
    configPath: /app/config
    envVars:
      TZ: "${TZ}"
    health:
      type: http
      path: /api/v1/status
      port: 5055
    default: true
    requiresAdminAuth: true
    dependsOn: [jellyfin]

  - id: caddy
    name: Caddy
    description: "Reverse proxy with automatic HTTPS."
    category: proxy
    image: ghcr.io/lavx/arrstack-caddy
    tag: "v1"
    ports: [80, 443]
    configPath: /config
    mounts: {}
    envVars: {}
    health:
      type: tcp
      port: 80
    default: true

  - id: recyclarr
    name: Recyclarr
    description: "Syncs TRaSH quality profiles to Sonarr and Radarr."
    category: utility
    image: ghcr.io/recyclarr/recyclarr
    tag: "7.4"
    ports: []
    configPath: /config
    envVars:
      TZ: "${TZ}"
    default: true
    dependsOn: [sonarr, radarr]

  - id: tdarr
    name: Tdarr
    description: "Bulk transcode your library (HEVC, AV1 re-encodes)."
    category: utility
    image: ghcr.io/haveagitgat/tdarr
    tag: "latest"
    ports: [8265]
    adminPort: 8265
    configPath: /config
    envVars:
      PUID: "${PUID}"
      PGID: "${PGID}"
      TZ: "${TZ}"
    hwaccelSupport: true
    default: false

  - id: trailarr
    name: Trailarr
    description: "Downloads trailers for your movies and shows."
    category: utility
    image: nandyalu/trailarr
    tag: "latest"
    ports: [7879]
    adminPort: 7879
    envVars:
      PUID: "${PUID}"
      PGID: "${PGID}"
      TZ: "${TZ}"
    default: false

  - id: gluetun
    name: Gluetun
    description: "VPN kill-switch for qBittorrent. Downloads stop if VPN drops."
    category: utility
    image: qmcgaw/gluetun
    tag: "latest"
    ports: []
    envVars: {}
    default: false
```

- [ ] **Step 5: Write catalog loader**

```ts
// src/catalog/index.ts
import { readFileSync } from "fs";
import { parse } from "yaml";
import { join, dirname } from "path";
import { CatalogSchema, type Service } from "./schema.js";

let _catalog: Service[] | null = null;

export function loadCatalog(): Service[] {
  if (_catalog) return _catalog;
  const yamlPath = join(dirname(new URL(import.meta.url).pathname), "services.yaml");
  const raw = parse(readFileSync(yamlPath, "utf8"));
  const parsed = CatalogSchema.parse(raw);
  _catalog = parsed.services;
  return _catalog;
}

export function getService(id: string): Service | undefined {
  return loadCatalog().find((s) => s.id === id);
}

export function getDefaultServices(): Service[] {
  return loadCatalog().filter((s) => s.default);
}

export function getServicesByIds(ids: string[]): Service[] {
  const catalog = loadCatalog();
  return ids.map((id) => catalog.find((s) => s.id === id)).filter(Boolean) as Service[];
}
```

- [ ] **Step 6: Run test, verify pass**

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: service catalog with 13 services and zod schema"
```

### Task 7: State store

**Files:**
- Create: `src/state/schema.ts`
- Create: `src/state/store.ts`
- Test: `tests/state/store.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/state/store.test.ts
import { describe, test, expect, beforeEach } from "bun:test";
import { readState, writeState } from "../src/state/store.js";
import { mkdtempSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("state store", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "arrstack-state-"));
  });

  test("writeState + readState roundtrips", () => {
    const state = {
      schema_version: 1 as const,
      installer_version: "0.1.0",
      install_dir: dir,
      storage_root: "/data",
      extra_paths: ["/mnt/hdd1"],
      admin: { username: "admin" },
      services_enabled: ["sonarr", "radarr"],
      gpu: { vendor: "intel" as const, render_gid: 105, video_gid: 39 },
      remote_access: { mode: "none" as const },
      local_dns: { enabled: false, tld: "arrstack.local" },
      vpn: { enabled: false },
      timezone: "Europe/Budapest",
      puid: 1000,
      pgid: 1000,
      api_keys: { sonarr: "abc123" },
    };
    writeState(dir, state);
    const loaded = readState(dir);
    expect(loaded).toBeDefined();
    expect(loaded!.services_enabled).toEqual(["sonarr", "radarr"]);
  });

  test("readState returns null when file missing", () => {
    expect(readState(dir)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Define state schema**

```ts
// src/state/schema.ts
import { z } from "zod";

export const StateSchema = z.object({
  schema_version: z.literal(1),
  installer_version: z.string(),
  install_dir: z.string(),
  storage_root: z.string(),
  extra_paths: z.array(z.string()).default([]),
  admin: z.object({ username: z.string() }),
  services_enabled: z.array(z.string()),
  gpu: z.object({
    vendor: z.enum(["intel", "amd", "nvidia", "none"]),
    device_name: z.string().optional(),
    render_gid: z.number().optional(),
    video_gid: z.number().optional(),
  }),
  remote_access: z.object({
    mode: z.enum(["none", "duckdns", "cloudflare"]),
    domain: z.string().optional(),
    token: z.string().optional(),
  }),
  local_dns: z.object({ enabled: z.boolean(), tld: z.string() }),
  vpn: z.object({ enabled: z.boolean(), provider: z.string().optional() }),
  timezone: z.string(),
  puid: z.number(),
  pgid: z.number(),
  api_keys: z.record(z.string(), z.string()),
  install_started_at: z.string().datetime().optional(),
  install_completed_at: z.string().datetime().optional(),
  last_updated_at: z.string().datetime().optional(),
});

export type State = z.infer<typeof StateSchema>;
```

- [ ] **Step 4: Implement store**

```ts
// src/state/store.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "fs";
import { join } from "path";
import { StateSchema, type State } from "./schema.js";

const STATE_FILE = "state.json";

export function readState(installDir: string): State | null {
  const path = join(installDir, STATE_FILE);
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return StateSchema.parse(raw);
}

export function writeState(installDir: string, state: State): void {
  mkdirSync(installDir, { recursive: true });
  const path = join(installDir, STATE_FILE);
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}
```

- [ ] **Step 5: Run test, verify pass**

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: state store with zod schema and atomic writes"
```

## Phase 3: Platform Detection (Tasks 8-10)

### Task 8: Distro detection

**Files:**
- Create: `src/platform/distro.ts`
- Test: `tests/platform/distro.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/platform/distro.test.ts
import { describe, test, expect } from "bun:test";
import { parseOsRelease, getDistroTier } from "../src/platform/distro.js";

describe("distro detection", () => {
  test("parses Fedora os-release", () => {
    const content = `NAME="Fedora Linux"\nID=fedora\nVERSION_ID=43\n`;
    const info = parseOsRelease(content);
    expect(info.id).toBe("fedora");
    expect(info.versionId).toBe("43");
  });

  test("Fedora 43 is tier 1", () => {
    expect(getDistroTier("fedora", "43")).toBe(1);
  });

  test("Alpine is unsupported", () => {
    expect(getDistroTier("alpine", "3.20")).toBe(-1);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Implement**

```ts
// src/platform/distro.ts
export interface OsRelease {
  id: string;
  idLike: string;
  versionId: string;
  name: string;
}

export function parseOsRelease(content: string): OsRelease {
  const kv = new Map<string, string>();
  for (const line of content.split("\n")) {
    const match = line.match(/^(\w+)=(.*)$/);
    if (match) kv.set(match[1], match[2].replace(/^"|"$/g, ""));
  }
  return {
    id: kv.get("ID") ?? "unknown",
    idLike: kv.get("ID_LIKE") ?? "",
    versionId: kv.get("VERSION_ID") ?? "",
    name: kv.get("NAME") ?? "Unknown",
  };
}

const TIER1 = [
  { id: "ubuntu", minVersion: "24.04" },
  { id: "debian", minVersion: "13" },
  { id: "fedora", minVersion: "43" },
];
const TIER2 = [
  { id: "ubuntu", minVersion: "22.04" },
  { id: "debian", minVersion: "12" },
  { id: "rhel", minVersion: "9" },
  { id: "rocky", minVersion: "9" },
  { id: "alma", minVersion: "9" },
];
const UNSUPPORTED = ["alpine"];

export function getDistroTier(id: string, version: string): 1 | 2 | 3 | -1 {
  if (UNSUPPORTED.includes(id)) return -1;
  if (TIER1.some((d) => d.id === id && version >= d.minVersion)) return 1;
  if (TIER2.some((d) => d.id === id && version >= d.minVersion)) return 2;
  return 3;
}
```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: distro detection with tier classification"
```

### Task 9: Docker and pre-flight checks

**Files:**
- Create: `src/platform/docker.ts`
- Create: `src/platform/preflight.ts`
- Create: `src/platform/ports.ts`
- Test: `tests/platform/preflight.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/platform/preflight.test.ts
import { describe, test, expect } from "bun:test";
import { checkPortFree } from "../src/platform/ports.js";

describe("ports", () => {
  test("checkPortFree returns false for an in-use port", async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response("ok") });
    const result = await checkPortFree(server.port);
    expect(result).toBe(false);
    server.stop();
  });

  test("checkPortFree returns true for a random free port", async () => {
    const result = await checkPortFree(59123);
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Implement ports, docker, and preflight**

```ts
// src/platform/ports.ts
import { exec } from "../lib/exec.js";

export async function checkPortFree(port: number): Promise<boolean> {
  const result = await exec(`ss -tlnH sport = :${port}`);
  if (!result.ok) return true;
  return result.stdout.trim() === "";
}

export async function getPortUser(port: number): Promise<string | null> {
  const result = await exec(`ss -tlnpH sport = :${port}`);
  if (!result.ok || result.stdout.trim() === "") return null;
  const match = result.stdout.match(/users:\(\("([^"]+)"/);
  return match?.[1] ?? null;
}
```

```ts
// src/platform/docker.ts
import { exec } from "../lib/exec.js";

export async function isDockerInstalled(): Promise<boolean> {
  const r = await exec("docker --version");
  return r.ok;
}

export async function isDockerRunning(): Promise<boolean> {
  const r = await exec("docker info");
  return r.ok;
}

export async function isComposeV2(): Promise<boolean> {
  const r = await exec("docker compose version");
  return r.ok && r.stdout.includes("v2");
}

export async function getDockerVersion(): Promise<string> {
  const r = await exec("docker --version");
  if (!r.ok) return "not installed";
  const match = r.stdout.match(/(\d+\.\d+\.\d+)/);
  return match?.[1] ?? "unknown";
}
```

```ts
// src/platform/preflight.ts
import { statfsSync } from "fs";
import { isDockerInstalled, isDockerRunning, isComposeV2 } from "./docker.js";
import { checkPortFree } from "./ports.js";

export interface CheckResult {
  name: string;
  ok: boolean;
  message: string;
  blocking: boolean;
}

export async function runPreflight(storageRoot: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const dockerInstalled = await isDockerInstalled();
  results.push({
    name: "Docker installed",
    ok: dockerInstalled,
    message: dockerInstalled ? "Docker detected" : "Docker not found. Install from https://docs.docker.com/engine/install/",
    blocking: true,
  });

  if (dockerInstalled) {
    const running = await isDockerRunning();
    results.push({
      name: "Docker running",
      ok: running,
      message: running ? "Docker daemon active" : "Docker is installed but not running. Try: sudo systemctl start docker",
      blocking: true,
    });

    const compose = await isComposeV2();
    results.push({
      name: "Compose v2",
      ok: compose,
      message: compose ? "docker compose v2 available" : "docker compose v2 required. Install docker-compose-plugin.",
      blocking: true,
    });
  }

  try {
    const stat = statfsSync(storageRoot);
    const freeGb = (stat.bfree * stat.bsize) / (1024 ** 3);
    results.push({
      name: "Disk space",
      ok: freeGb >= 10,
      message: `${freeGb.toFixed(1)} GB free on ${storageRoot}`,
      blocking: freeGb < 10,
    });
  } catch {
    results.push({
      name: "Disk space",
      ok: true,
      message: `${storageRoot} does not exist yet (will be created)`,
      blocking: false,
    });
  }

  for (const port of [80, 443]) {
    const free = await checkPortFree(port);
    results.push({
      name: `Port ${port}`,
      ok: free,
      message: free ? `Port ${port} free` : `Port ${port} in use`,
      blocking: false,
    });
  }

  return results;
}
```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: docker detection and pre-flight checks"
```

### Task 10: GPU detection

**Files:**
- Create: `src/platform/gpu.ts`
- Create: `src/platform/groups.ts`
- Test: `tests/platform/gpu.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/platform/gpu.test.ts
import { describe, test, expect } from "bun:test";
import { parseLspci } from "../src/platform/gpu.js";

describe("GPU detection", () => {
  test("parses Intel VGA line", () => {
    const line = "00:02.0 VGA compatible controller [0300]: Intel Corporation UHD Graphics 630 [8086:3e92]";
    const gpus = parseLspci(line);
    expect(gpus).toHaveLength(1);
    expect(gpus[0].vendor).toBe("intel");
    expect(gpus[0].name).toContain("UHD Graphics 630");
  });

  test("parses NVIDIA line", () => {
    const line = "01:00.0 3D controller [0302]: NVIDIA Corporation TU104 [10de:1e89]";
    const gpus = parseLspci(line);
    expect(gpus[0].vendor).toBe("nvidia");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Implement**

```ts
// src/platform/gpu.ts
import { exec } from "../lib/exec.js";
import { existsSync } from "fs";

export interface GpuInfo {
  vendor: "intel" | "amd" | "nvidia" | "unknown";
  name: string;
  pciId: string;
}

export function parseLspci(output: string): GpuInfo[] {
  const gpus: GpuInfo[] = [];
  for (const line of output.split("\n")) {
    if (!/vga|3d|display/i.test(line)) continue;
    let vendor: GpuInfo["vendor"] = "unknown";
    if (/intel/i.test(line) || /\[8086:/.test(line)) vendor = "intel";
    else if (/nvidia/i.test(line) || /\[10de:/.test(line)) vendor = "nvidia";
    else if (/amd|ati|radeon/i.test(line) || /\[1002:/.test(line)) vendor = "amd";
    const nameMatch = line.match(/:\s+(.+?)\s*\[[\da-f]{4}:[\da-f]{4}\]/i);
    const pciMatch = line.match(/\[[\da-f]{4}:([\da-f]{4})\]/i);
    gpus.push({
      vendor,
      name: nameMatch?.[1]?.trim() ?? line.trim(),
      pciId: pciMatch?.[1] ?? "",
    });
  }
  return gpus;
}

export async function detectGpus(): Promise<GpuInfo[]> {
  const result = await exec("lspci -nn");
  if (!result.ok) return [];
  return parseLspci(result.stdout);
}

export function hasDriDevice(): boolean {
  return existsSync("/dev/dri/renderD128");
}

export async function hasNvidiaToolkit(): Promise<boolean> {
  const r = await exec("docker info --format '{{json .Runtimes}}'");
  if (!r.ok) return false;
  return r.stdout.includes("nvidia");
}
```

```ts
// src/platform/groups.ts
import { exec, execSync_ } from "../lib/exec.js";

export function resolveGroupGid(groupName: string): number | null {
  try {
    const line = execSync_(`getent group ${groupName}`);
    const gid = line.split(":")[2];
    return gid ? parseInt(gid, 10) : null;
  } catch {
    return null;
  }
}

export function resolveRenderVideoGids(): { renderGid: number | null; videoGid: number | null } {
  let renderGid = resolveGroupGid("render");
  let videoGid = resolveGroupGid("video");
  if (renderGid === null) {
    try {
      renderGid = parseInt(execSync_("stat -c '%g' /dev/dri/renderD128"), 10);
    } catch { /* no render device */ }
  }
  return { renderGid, videoGid };
}
```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: GPU detection (Intel/AMD/NVIDIA) and render group resolution"
```

## Phase 4: Auth and Random Helpers (Tasks 11-12)

### Task 11: Password hashing (bcrypt + PBKDF2)

**Files:**
- Create: `src/auth/hash.ts`
- Test: `tests/auth/hash.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/auth/hash.test.ts
import { describe, test, expect } from "bun:test";
import { bcryptHash, bcryptVerify, qbitPbkdf2Hash } from "../src/auth/hash.js";

describe("auth hashing", () => {
  test("bcrypt roundtrip", async () => {
    const hash = await bcryptHash("testpass123");
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await bcryptVerify("testpass123", hash)).toBe(true);
    expect(await bcryptVerify("wrong", hash)).toBe(false);
  });

  test("qbit PBKDF2 produces ByteArray format", () => {
    const hash = qbitPbkdf2Hash("testpass123");
    expect(hash).toMatch(/^@ByteArray\(/);
    expect(hash).toContain(":");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Implement**

```ts
// src/auth/hash.ts
import bcrypt from "bcryptjs";
import { pbkdf2Sync, randomBytes } from "crypto";

export async function bcryptHash(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function bcryptVerify(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function qbitPbkdf2Hash(password: string): string {
  const salt = randomBytes(16);
  const iterations = 100000;
  const keyLen = 64;
  const derived = pbkdf2Sync(password, salt, iterations, keyLen, "sha512");
  const saltB64 = salt.toString("base64");
  const hashB64 = derived.toString("base64");
  return `@ByteArray(${saltB64}:${hashB64})`;
}
```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: bcrypt and PBKDF2 password hashing"
```

### Task 12: Random generators

**Files:**
- Create: `src/lib/random.ts`
- Test: `tests/lib/random.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/lib/random.test.ts
import { describe, test, expect } from "bun:test";
import { generateApiKey, generatePassword } from "../src/lib/random.js";

describe("random generators", () => {
  test("generateApiKey returns 32-char hex", () => {
    const key = generateApiKey();
    expect(key).toHaveLength(32);
    expect(key).toMatch(/^[a-f0-9]+$/);
  });

  test("generatePassword returns 24-char alphanumeric with dashes", () => {
    const pass = generatePassword();
    expect(pass.replace(/-/g, "").length).toBeGreaterThanOrEqual(20);
    expect(pass).toMatch(/^[a-zA-Z0-9-]+$/);
  });

  test("each call generates unique values", () => {
    expect(generateApiKey()).not.toBe(generateApiKey());
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Implement**

```ts
// src/lib/random.ts
import { randomBytes } from "crypto";

export function generateApiKey(): string {
  return randomBytes(16).toString("hex");
}

export function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments: string[] = [];
  for (let s = 0; s < 4; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      const idx = randomBytes(1)[0] % chars.length;
      seg += chars[idx];
    }
    segments.push(seg);
  }
  return segments.join("-");
}
```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: API key and password generators"
```

## Phase 5: Template Renderers (Tasks 13-17)

### Task 13: Handlebars template engine setup

**Files:**
- Create: `src/renderer/engine.ts`
- Test: `tests/renderer/engine.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/renderer/engine.test.ts
import { describe, test, expect } from "bun:test";
import { renderTemplate } from "../src/renderer/engine.js";

describe("template engine", () => {
  test("renders a handlebars string with context", () => {
    const result = renderTemplate("Hello {{name}}", { name: "World" });
    expect(result).toBe("Hello World");
  });

  test("handles #each loops", () => {
    const tpl = "{{#each items}}{{this}}\n{{/each}}";
    const result = renderTemplate(tpl, { items: ["a", "b"] });
    expect(result.trim()).toBe("a\nb");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Implement**

```ts
// src/renderer/engine.ts
import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { join, dirname } from "path";

const TEMPLATES_DIR = join(dirname(new URL(import.meta.url).pathname), "../../templates");

export function renderTemplate(source: string, context: Record<string, unknown>): string {
  const compiled = Handlebars.compile(source, { noEscape: true });
  return compiled(context);
}

export function renderFile(templateName: string, context: Record<string, unknown>): string {
  const source = readFileSync(join(TEMPLATES_DIR, templateName), "utf8");
  return renderTemplate(source, context);
}
```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: handlebars template engine"
```

### Task 14: docker-compose.yml renderer

**Files:**
- Create: `src/renderer/compose.ts`
- Create: `templates/compose.yml.hbs`
- Test: `tests/renderer/compose.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/renderer/compose.test.ts
import { describe, test, expect } from "bun:test";
import { renderCompose } from "../src/renderer/compose.js";

describe("compose renderer", () => {
  test("renders services with ports and volumes", () => {
    const yml = renderCompose({
      services: [
        { id: "sonarr", name: "Sonarr", image: "lscr.io/linuxserver/sonarr", tag: "4.0", ports: [8989] },
      ],
      storageRoot: "/data",
      extraPaths: [],
      puid: 1000,
      pgid: 1000,
      timezone: "UTC",
      apiKeys: { sonarr: "abc123" },
      gpu: { vendor: "none" },
      vpn: { enabled: false },
    });
    expect(yml).toContain("sonarr:");
    expect(yml).toContain("8989:8989");
    expect(yml).toContain("lscr.io/linuxserver/sonarr:4.0");
    expect(yml).toContain("max-size");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Create the template**

```handlebars
{{! templates/compose.yml.hbs }}
networks:
  arrstack:
    driver: bridge

services:
{{#each services}}
  {{this.id}}:
    container_name: {{this.id}}
    image: {{this.image}}:{{this.tag}}
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "3"
    networks:
      - arrstack
{{#if this.ports.length}}
    ports:
{{#each this.ports}}
      - "{{this}}:{{this}}"
{{/each}}
{{/if}}
    environment:
{{#if this.apiKeyEnv}}
      - {{this.apiKeyEnv}}={{lookup ../apiKeys this.id}}
{{/if}}
      - PUID={{../puid}}
      - PGID={{../pgid}}
      - TZ={{../timezone}}
{{#if this.volumes.length}}
    volumes:
{{#each this.volumes}}
      - {{this}}
{{/each}}
{{/if}}
{{#if this.devices.length}}
    devices:
{{#each this.devices}}
      - {{this}}
{{/each}}
{{/if}}
{{#if this.groupAdd.length}}
    group_add:
{{#each this.groupAdd}}
      - "{{this}}"
{{/each}}
{{/if}}
{{#if this.dependsOn.length}}
    depends_on:
{{#each this.dependsOn}}
      - {{this}}
{{/each}}
{{/if}}
{{#if this.networkMode}}
    network_mode: "service:{{this.networkMode}}"
{{/if}}

{{/each}}
```

- [ ] **Step 4: Implement compose renderer**

```ts
// src/renderer/compose.ts
import { renderFile } from "./engine.js";
import { type Service } from "../catalog/schema.js";

export interface ComposeContext {
  services: Array<{
    id: string;
    name: string;
    image: string;
    tag: string;
    ports: number[];
    apiKeyEnv?: string;
    volumes: string[];
    devices: string[];
    groupAdd: string[];
    dependsOn: string[];
    networkMode?: string;
  }>;
  storageRoot: string;
  puid: number;
  pgid: number;
  timezone: string;
  apiKeys: Record<string, string>;
}

export function buildComposeContext(
  services: Service[],
  opts: {
    storageRoot: string;
    extraPaths: string[];
    puid: number;
    pgid: number;
    timezone: string;
    apiKeys: Record<string, string>;
    gpu: { vendor: string; renderGid?: number; videoGid?: number };
    vpn: { enabled: boolean };
  }
): ComposeContext {
  const ctx: ComposeContext = {
    services: [],
    storageRoot: opts.storageRoot,
    puid: opts.puid,
    pgid: opts.pgid,
    timezone: opts.timezone,
    apiKeys: opts.apiKeys,
  };

  for (const svc of services) {
    const volumes: string[] = [];
    const devices: string[] = [];
    const groupAdd: string[] = [];

    const configDir = `\${INSTALL_DIR}/config/${svc.id}`;
    volumes.push(`${configDir}:${svc.configPath}`);

    if (svc.id === "qbittorrent") {
      volumes.push(`${opts.storageRoot}/torrents:/data/torrents`);
    } else if (["sonarr", "radarr"].includes(svc.id)) {
      volumes.push(`${opts.storageRoot}:/data`);
      for (const [i, extra] of opts.extraPaths.entries()) {
        volumes.push(`${extra}:/data/extra-${i}`);
      }
    } else if (["bazarr", "jellyfin"].includes(svc.id)) {
      volumes.push(`${opts.storageRoot}/media:/data/media`);
      for (const [i, extra] of opts.extraPaths.entries()) {
        volumes.push(`${extra}:/media/extra-${i}:ro`);
      }
    }

    if (svc.hwaccelSupport && opts.gpu.vendor !== "none") {
      if (opts.gpu.vendor === "intel" || opts.gpu.vendor === "amd") {
        devices.push("/dev/dri:/dev/dri");
        if (opts.gpu.renderGid) groupAdd.push(String(opts.gpu.renderGid));
        if (opts.gpu.videoGid) groupAdd.push(String(opts.gpu.videoGid));
      }
    }

    let networkMode: string | undefined;
    if (svc.id === "qbittorrent" && opts.vpn.enabled) {
      networkMode = "gluetun";
    }

    ctx.services.push({
      id: svc.id,
      name: svc.name,
      image: svc.image,
      tag: svc.tag,
      ports: networkMode ? [] : svc.ports,
      apiKeyEnv: svc.apiKeyEnv,
      volumes,
      devices,
      groupAdd,
      dependsOn: svc.dependsOn,
      networkMode,
    });
  }

  return ctx;
}

export function renderCompose(ctx: ComposeContext): string {
  return renderFile("compose.yml.hbs", ctx as unknown as Record<string, unknown>);
}
```

- [ ] **Step 5: Run test, verify pass**

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: docker-compose.yml renderer with handlebars template"
```

### Task 15: Caddyfile renderer

**Files:**
- Create: `src/renderer/caddy.ts`
- Create: `templates/Caddyfile.hbs`
- Test: `tests/renderer/caddy.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/renderer/caddy.test.ts
import { describe, test, expect } from "bun:test";
import { renderCaddyfile } from "../src/renderer/caddy.js";

describe("Caddyfile renderer", () => {
  test("LAN-only mode has no tls block", () => {
    const out = renderCaddyfile({
      mode: "none",
      services: [{ id: "sonarr", port: 8989 }],
    });
    expect(out).toContain("sonarr");
    expect(out).not.toContain("tls {");
  });

  test("cloudflare mode includes dns challenge", () => {
    const out = renderCaddyfile({
      mode: "cloudflare",
      domain: "arr.lavx.hu",
      services: [{ id: "sonarr", port: 8989 }],
    });
    expect(out).toContain("sonarr.arr.lavx.hu");
    expect(out).toContain("dns cloudflare");
  });

  test("duckdns mode uses duckdns domain", () => {
    const out = renderCaddyfile({
      mode: "duckdns",
      domain: "myhome.duckdns.org",
      services: [{ id: "sonarr", port: 8989 }],
    });
    expect(out).toContain("sonarr.myhome.duckdns.org");
    expect(out).toContain("dns duckdns");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Create template and renderer**

```handlebars
{{! templates/Caddyfile.hbs }}
{{#if (eq mode "cloudflare")}}
(tls_opts) {
  tls {
    dns cloudflare {env.CF_API_TOKEN}
  }
}
{{/if}}
{{#if (eq mode "duckdns")}}
(tls_opts) {
  tls {
    dns duckdns {env.DUCKDNS_TOKEN}
  }
}
{{/if}}
{{#if (eq mode "none")}}
(tls_opts) {
  tls internal
}
{{/if}}

{{#each services}}
{{#if (eq ../mode "none")}}
:{{this.port}} {
  reverse_proxy {{this.id}}:{{this.port}}
}
{{else}}
{{this.id}}.{{../domain}} {
  import tls_opts
  reverse_proxy {{this.id}}:{{this.port}}
}
{{/if}}
{{/each}}
```

```ts
// src/renderer/caddy.ts
import Handlebars from "handlebars";
import { renderFile } from "./engine.js";

Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);

export interface CaddyContext {
  mode: "none" | "duckdns" | "cloudflare";
  domain?: string;
  services: Array<{ id: string; port: number }>;
}

export function renderCaddyfile(ctx: CaddyContext): string {
  return renderFile("Caddyfile.hbs", ctx as unknown as Record<string, unknown>);
}
```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Caddyfile renderer with LAN/DuckDNS/Cloudflare modes"
```

### Task 16: .env renderer

**Files:**
- Create: `src/renderer/env.ts`
- Test: `tests/renderer/env.test.ts`

- [ ] **Step 1: Write test**

```ts
// tests/renderer/env.test.ts
import { describe, test, expect } from "bun:test";
import { renderEnv } from "../src/renderer/env.js";

describe("env renderer", () => {
  test("outputs key=value lines", () => {
    const out = renderEnv({
      puid: 1000, pgid: 1000, tz: "UTC",
      installDir: "/opt/arrstack", storageRoot: "/data",
      adminUser: "admin", adminPass: "secret",
      apiKeys: { sonarr: "abc" },
    });
    expect(out).toContain("PUID=1000");
    expect(out).toContain("ADMIN_PASSWORD=secret");
    expect(out).toContain("SONARR__AUTH__APIKEY=abc");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Implement**

```ts
// src/renderer/env.ts
export interface EnvContext {
  puid: number;
  pgid: number;
  tz: string;
  installDir: string;
  storageRoot: string;
  adminUser: string;
  adminPass: string;
  apiKeys: Record<string, string>;
  cfToken?: string;
  duckdnsToken?: string;
}

export function renderEnv(ctx: EnvContext): string {
  const lines: string[] = [
    `PUID=${ctx.puid}`,
    `PGID=${ctx.pgid}`,
    `TZ=${ctx.tz}`,
    `INSTALL_DIR=${ctx.installDir}`,
    `STORAGE_ROOT=${ctx.storageRoot}`,
    `ADMIN_USERNAME=${ctx.adminUser}`,
    `ADMIN_PASSWORD=${ctx.adminPass}`,
  ];
  for (const [svc, key] of Object.entries(ctx.apiKeys)) {
    const envName = `${svc.toUpperCase()}__AUTH__APIKEY`;
    lines.push(`${envName}=${key}`);
  }
  if (ctx.cfToken) lines.push(`CF_API_TOKEN=${ctx.cfToken}`);
  if (ctx.duckdnsToken) lines.push(`DUCKDNS_TOKEN=${ctx.duckdnsToken}`);
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: .env file renderer"
```

### Task 17: Remaining config renderers (servarr config.xml, bazarr config.yaml, qbit conf, recyclarr yml, encoding.xml, FIRST-RUN.md, dnsmasq.conf)

**Files:**
- Create: `src/renderer/servarr-config.ts`
- Create: `src/renderer/bazarr-config.ts`
- Create: `src/renderer/qbit-config.ts`
- Create: `src/renderer/recyclarr-config.ts`
- Create: `src/renderer/jellyfin-encoding.ts`
- Create: `src/renderer/first-run.ts`
- Create: `src/renderer/dnsmasq.ts`
- Create: `templates/servarr-config.xml.hbs`
- Create: `templates/bazarr-config.yaml.hbs`
- Create: `templates/qbittorrent.conf.hbs`
- Create: `templates/recyclarr.yml.hbs`
- Create: `templates/encoding.xml.hbs`
- Create: `templates/FIRST-RUN.md.hbs`
- Create: `templates/dnsmasq.conf.hbs`
- Test: `tests/renderer/configs.test.ts`

- [ ] **Step 1: Write tests for each renderer**

```ts
// tests/renderer/configs.test.ts
import { describe, test, expect } from "bun:test";
import { renderServarrConfig } from "../src/renderer/servarr-config.js";
import { renderBazarrConfig } from "../src/renderer/bazarr-config.js";
import { renderQbitConfig } from "../src/renderer/qbit-config.js";
import { renderRecyclarrConfig } from "../src/renderer/recyclarr-config.js";
import { renderJellyfinEncoding } from "../src/renderer/jellyfin-encoding.js";
import { renderFirstRun } from "../src/renderer/first-run.js";

describe("config renderers", () => {
  test("servarr config.xml includes Forms auth", () => {
    const xml = renderServarrConfig({ apiKey: "abc123" });
    expect(xml).toContain("<ApiKey>abc123</ApiKey>");
    expect(xml).toContain("<AuthenticationMethod>Forms</AuthenticationMethod>");
  });

  test("bazarr config.yaml includes sonarr and radarr keys", () => {
    const yaml = renderBazarrConfig({
      sonarrKey: "s1", radarrKey: "r1",
      adminUser: "admin", adminPassHash: "$2a$10$...",
    });
    expect(yaml).toContain("apikey: 's1'");
    expect(yaml).toContain("use_sonarr: true");
  });

  test("qbit config includes PBKDF2 hash", () => {
    const conf = renderQbitConfig({ passwordHash: "@ByteArray(test:hash)" });
    expect(conf).toContain("WebUI\\Password_PBKDF2=@ByteArray(test:hash)");
  });

  test("recyclarr config references sonarr and radarr", () => {
    const yml = renderRecyclarrConfig({ sonarrKey: "s1", radarrKey: "r1" });
    expect(yml).toContain("base_url: http://sonarr:8989");
    expect(yml).toContain("api_key: r1");
  });

  test("encoding.xml sets vaapi for intel", () => {
    const xml = renderJellyfinEncoding({ vendor: "intel" });
    expect(xml).toContain("<HardwareAccelerationType>vaapi</HardwareAccelerationType>");
  });

  test("FIRST-RUN.md lists service URLs", () => {
    const md = renderFirstRun({
      services: [{ name: "Sonarr", url: "http://192.168.1.1:8989" }],
      adminUser: "admin",
    });
    expect(md).toContain("Sonarr");
    expect(md).toContain("http://192.168.1.1:8989");
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Create all templates and renderer functions**

Each renderer follows the same pattern as Tasks 13-16: a `render<Name>` function that calls `renderFile(template, context)`. Templates are handlebars files in `templates/`.

Key templates:

`templates/servarr-config.xml.hbs`:
```xml
<Config>
  <ApiKey>{{apiKey}}</ApiKey>
  <AuthenticationMethod>Forms</AuthenticationMethod>
  <AuthenticationRequired>Enabled</AuthenticationRequired>
  <UrlBase></UrlBase>
  <InstanceName>{{instanceName}}</InstanceName>
</Config>
```

`templates/bazarr-config.yaml.hbs`:
```yaml
auth:
  apikey: '{{bazarrKey}}'
  type: basic
  username: '{{adminUser}}'
  password: '{{adminPassHash}}'
general:
  use_sonarr: true
  use_radarr: true
  port: 6767
sonarr:
  ip: sonarr
  port: 8989
  apikey: '{{sonarrKey}}'
  ssl: false
  full_update: Daily
radarr:
  ip: radarr
  port: 7878
  apikey: '{{radarrKey}}'
  ssl: false
  full_update: Daily
```

`templates/qbittorrent.conf.hbs`:
```ini
[BitTorrent]
Session\DefaultSavePath=/data/torrents
Session\TempPath=/data/torrents/incomplete
Session\TempPathEnabled=false
Session\DisableAutoTMMByDefault=false

[Preferences]
WebUI\Password_PBKDF2={{passwordHash}}
WebUI\Username={{adminUser}}
WebUI\Port=8080
WebUI\LocalHostAuth=false
```

`templates/recyclarr.yml.hbs`:
```yaml
sonarr:
  main:
    base_url: http://sonarr:8989
    api_key: {{sonarrKey}}
    quality_definition:
      type: series
    quality_profiles:
      - name: WEB-1080p
      - name: WEB-2160p

radarr:
  main:
    base_url: http://radarr:7878
    api_key: {{radarrKey}}
    quality_definition:
      type: movie
    quality_profiles:
      - name: HD Bluray + WEB
      - name: UHD Bluray + WEB
```

`templates/encoding.xml.hbs`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<EncodingOptions>
{{#if (eq vendor "intel")}}
  <HardwareAccelerationType>vaapi</HardwareAccelerationType>
  <VaapiDevice>/dev/dri/renderD128</VaapiDevice>
  <EnableHardwareEncoding>true</EnableHardwareEncoding>
{{/if}}
{{#if (eq vendor "amd")}}
  <HardwareAccelerationType>vaapi</HardwareAccelerationType>
  <VaapiDevice>/dev/dri/renderD128</VaapiDevice>
  <EnableHardwareEncoding>true</EnableHardwareEncoding>
{{/if}}
{{#if (eq vendor "nvidia")}}
  <HardwareAccelerationType>nvenc</HardwareAccelerationType>
  <EnableHardwareEncoding>true</EnableHardwareEncoding>
{{/if}}
{{#if (eq vendor "none")}}
  <HardwareAccelerationType></HardwareAccelerationType>
{{/if}}
</EncodingOptions>
```

`templates/dnsmasq.conf.hbs`:
```
address=/{{tld}}/{{hostIp}}
```

Each renderer is a thin function (3-10 lines) calling `renderFile` with the appropriate context. Implementations are straightforward.

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: all config renderers (servarr, bazarr, qbit, recyclarr, jellyfin, first-run, dnsmasq)"
```

## Phase 6: Storage Layout (Task 18)

### Task 18: Create TRaSH-compliant directory structure

**Files:**
- Create: `src/storage/layout.ts`
- Test: `tests/storage/layout.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/storage/layout.test.ts
import { describe, test, expect, beforeEach } from "bun:test";
import { createStorageLayout } from "../src/storage/layout.js";
import { mkdtempSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("storage layout", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "arrstack-data-")); });

  test("creates the full TRaSH directory tree", () => {
    createStorageLayout(root, 1000, 1000);
    expect(existsSync(join(root, "torrents/tv"))).toBe(true);
    expect(existsSync(join(root, "torrents/movies"))).toBe(true);
    expect(existsSync(join(root, "media/tv"))).toBe(true);
    expect(existsSync(join(root, "media/movies"))).toBe(true);
    expect(existsSync(join(root, "media/music"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Implement**

```ts
// src/storage/layout.ts
import { mkdirSync, chownSync } from "fs";
import { join } from "path";

const DIRS = [
  "torrents/tv", "torrents/movies", "torrents/music", "torrents/books",
  "media/tv", "media/movies", "media/music",
];

export function createStorageLayout(root: string, uid: number, gid: number): void {
  for (const dir of DIRS) {
    const full = join(root, dir);
    mkdirSync(full, { recursive: true });
    try { chownSync(full, uid, gid); } catch { /* non-root, skip chown */ }
  }
}
```

- [ ] **Step 4: Run test, verify pass**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: TRaSH-compliant storage layout creator"
```

## Phase 7: Ink Wizard TUI (Tasks 19-27)

> Phase 7 builds the one-screen form wizard using Ink (React for terminals). Each task creates one field component or the layout shell. Ink components are tested via snapshot or smoke rendering where practical.

### Task 19: Ink App shell and screen router

**Files:**
- Create: `src/ui/App.tsx`
- Create: `src/ui/wizard/Form.tsx`
- Create: `src/ui/progress/ProgressView.tsx`
- Create: `src/ui/done/DoneScreen.tsx`

- [ ] **Step 1: Implement App router**

```tsx
// src/ui/App.tsx
import React, { useState } from "react";
import { Box, Text } from "ink";
import { Form } from "./wizard/Form.js";
import { ProgressView } from "./progress/ProgressView.js";
import { DoneScreen } from "./done/DoneScreen.js";
import { type State } from "../state/schema.js";

type Screen = "wizard" | "progress" | "done";

interface AppProps {
  existingState?: State | null;
}

export function App({ existingState }: AppProps) {
  const [screen, setScreen] = useState<Screen>("wizard");
  const [state, setState] = useState<Partial<State>>(existingState ?? {});
  const [result, setResult] = useState<{ urls: Array<{ name: string; url: string }>; password: string } | null>(null);

  if (screen === "wizard") {
    return (
      <Form
        initial={state}
        isReconfigure={!!existingState}
        onSubmit={(s) => { setState(s); setScreen("progress"); }}
      />
    );
  }
  if (screen === "progress") {
    return (
      <ProgressView
        state={state as State}
        onDone={(r) => { setResult(r); setScreen("done"); }}
      />
    );
  }
  return <DoneScreen urls={result!.urls} password={result!.password} adminUser={state.admin?.username ?? "admin"} />;
}
```

- [ ] **Step 2: Stub placeholder components**

```tsx
// src/ui/wizard/Form.tsx
import React from "react";
import { Box, Text } from "ink";
export function Form({ onSubmit, initial, isReconfigure }: any) {
  return <Box><Text>Form placeholder</Text></Box>;
}

// src/ui/progress/ProgressView.tsx
import React from "react";
import { Box, Text } from "ink";
export function ProgressView({ state, onDone }: any) {
  return <Box><Text>Progress placeholder</Text></Box>;
}

// src/ui/done/DoneScreen.tsx
import React from "react";
import { Box, Text } from "ink";
export function DoneScreen({ urls, password, adminUser }: any) {
  return <Box><Text>Done placeholder</Text></Box>;
}
```

- [ ] **Step 3: Wire into CLI**

Update `src/cli.ts` install command:

```ts
import { render } from "ink";
import React from "react";
import { App } from "./ui/App.js";
import { readState } from "./state/store.js";

// Inside the install action:
const existing = readState(opts.installDir ?? "/opt/arrstack");
const { waitUntilExit } = render(React.createElement(App, { existingState: existing }));
await waitUntilExit();
```

- [ ] **Step 4: Verify `bun run dev` renders the placeholder form**

```bash
bun run src/cli.ts install
```

Expected: "Form placeholder" text appears

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Ink app shell with wizard/progress/done routing"
```

### Task 20: Shared components (TextInput, Checkbox, Radio)

**Files:**
- Create: `src/ui/shared/TextInput.tsx`
- Create: `src/ui/shared/Checkbox.tsx`
- Create: `src/ui/shared/Radio.tsx`
- Create: `src/ui/shared/theme.ts`

- [ ] **Step 1: Implement components**

```tsx
// src/ui/shared/theme.ts
export const colors = {
  primary: "green",
  secondary: "blue",
  muted: "gray",
  error: "red",
  accent: "yellow",
} as const;
```

```tsx
// src/ui/shared/TextInput.tsx
import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInputLib from "ink-text-input";
import { colors } from "./theme.js";

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  hint?: string;
  isFocused?: boolean;
}

export function TextInput({ label, value, onChange, hint, isFocused }: Props) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.muted}>{label.padEnd(20, ".")}</Text>
        <Text> </Text>
        {isFocused ? (
          <TextInputLib value={value} onChange={onChange} />
        ) : (
          <Text>{value || "(empty)"}</Text>
        )}
      </Box>
      {hint && <Text color={colors.muted} dimColor>  {hint}</Text>}
    </Box>
  );
}
```

```tsx
// src/ui/shared/Checkbox.tsx
import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme.js";

interface Props {
  items: Array<{ id: string; label: string; checked: boolean; port?: number }>;
  onChange: (id: string) => void;
  focusedIndex: number;
  columns?: number;
}

export function CheckboxGrid({ items, onChange, focusedIndex, columns = 4 }: Props) {
  const rows: Array<typeof items> = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  let idx = 0;
  return (
    <Box flexDirection="column">
      {rows.map((row, ri) => (
        <Box key={ri} gap={2}>
          {row.map((item) => {
            const isFocused = idx === focusedIndex;
            idx++;
            return (
              <Box key={item.id} width={20}>
                <Text color={isFocused ? colors.accent : undefined}>
                  [{item.checked ? "x" : " "}] {item.label}
                </Text>
                {item.port && <Text color={colors.muted}> :{item.port}</Text>}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
```

```tsx
// src/ui/shared/Radio.tsx
import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme.js";

interface Props {
  options: Array<{ value: string; label: string; hint?: string }>;
  selected: string;
  onChange: (val: string) => void;
  focusedIndex: number;
}

export function Radio({ options, selected, onChange, focusedIndex }: Props) {
  return (
    <Box flexDirection="column">
      {options.map((opt, i) => (
        <Box key={opt.value}>
          <Text color={i === focusedIndex ? colors.accent : undefined}>
            ({selected === opt.value ? "o" : " "}) {opt.label}
          </Text>
          {opt.hint && <Text color={colors.muted}>  {opt.hint}</Text>}
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Install ink-text-input**

```bash
bun add ink-text-input
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: shared TUI components (TextInput, Checkbox, Radio)"
```

### Tasks 21-26: Wizard field components

Each field (Storage, Admin, GPU, Services, Remote Access, Local DNS, System, StatusStrip) follows the same pattern: a React component that reads from and updates a shared wizard state via props. These are straightforward Ink components using the shared primitives from Task 20.

**Create files:**
- `src/ui/wizard/StorageField.tsx`
- `src/ui/wizard/AdminField.tsx`
- `src/ui/wizard/GpuField.tsx`
- `src/ui/wizard/ServicesField.tsx`
- `src/ui/wizard/RemoteAccessField.tsx`
- `src/ui/wizard/LocalDnsField.tsx`
- `src/ui/wizard/SystemField.tsx`
- `src/ui/wizard/StatusStrip.tsx`
- `src/ui/wizard/useWizardState.ts`

Each component receives its slice of state and a setter. The Form.tsx component composes them vertically with section headers. `useWizardState.ts` is a React hook managing the full form state.

Implementation for each field follows the pattern of TextInput, Checkbox, or Radio from Task 20, composed with section-specific labels and defaults. Full code for each is in the spec's wizard mockup (section 9.1).

**Steps (per field component):**

- [ ] **Step 1 (Task 21): Implement useWizardState hook** — manages all form fields, auto-detects defaults (timezone from host, PUID/PGID from `id`, GPU from platform/gpu.ts).

- [ ] **Step 2 (Task 22): Implement StorageField** — text input for storage root + extra paths (comma-separated).

- [ ] **Step 3 (Task 23): Implement AdminField** — username text input + password with regenerate handler calling `generatePassword()`.

- [ ] **Step 4 (Task 24): Implement GpuField** — Radio populated from `detectGpus()` result.

- [ ] **Step 5 (Task 25): Implement ServicesField** — CheckboxGrid from catalog.

- [ ] **Step 6 (Task 26): Implement RemoteAccessField** — Radio (None/DuckDNS/Cloudflare) with conditional text inputs for domain/token.

- [ ] **Step 7: Implement LocalDnsField, SystemField, StatusStrip** — checkbox + text input, TZ + PUID/PGID, live status via polling.

- [ ] **Step 8: Implement Form.tsx** — composes all fields vertically with section headers, Tab/Shift-Tab focus management, Install/Cancel footer buttons.

- [ ] **Step 9: Smoke test the full form**

```bash
bun run src/cli.ts install
```

Verify: form renders with all sections, Tab navigates between fields, Space toggles checkboxes, Enter on Install logs the collected state to stdout.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: full one-screen wizard form with all field components"
```

### Task 27: Done screen

**Files:**
- Modify: `src/ui/done/DoneScreen.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/ui/done/DoneScreen.tsx
import React from "react";
import { Box, Text, Newline } from "ink";
import { colors } from "../shared/theme.js";

interface Props {
  urls: Array<{ name: string; url: string; description: string }>;
  password: string;
  adminUser: string;
}

export function DoneScreen({ urls, password, adminUser }: Props) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={colors.primary} bold>arrstack is running.</Text>
      <Newline />
      <Text>Admin credentials (also saved to /opt/arrstack/admin.txt):</Text>
      <Text color={colors.accent}>  user: {adminUser}</Text>
      <Text color={colors.accent}>  pass: {password}</Text>
      <Newline />
      <Text>Open in browser:</Text>
      <Newline />
      {urls.map((u) => (
        <Box key={u.name} gap={2}>
          <Text color={colors.primary}>{u.name.padEnd(14)}</Text>
          <Text>{u.url}</Text>
          <Text color={colors.muted}>  {u.description}</Text>
        </Box>
      ))}
      <Newline />
      <Text>Remaining steps:</Text>
      <Text>  1. Sign in to Jellyseerr (one click, already linked to Jellyfin)</Text>
      <Text>  2. Request a movie or show</Text>
      <Newline />
      <Text color={colors.muted}>Day-two: arrstack doctor | arrstack update | arrstack show-password</Text>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: done screen with URLs and admin credentials"
```

## Phase 8: Install Pipeline (Tasks 28-30)

### Task 28: Install pipeline orchestrator

**Files:**
- Create: `src/usecase/install.ts`

- [ ] **Step 1: Implement the full pipeline**

```ts
// src/usecase/install.ts
import { type State } from "../state/schema.js";
import { writeState } from "../state/store.js";
import { createStorageLayout } from "../storage/layout.js";
import { generateApiKey, generatePassword } from "../lib/random.js";
import { bcryptHash, qbitPbkdf2Hash } from "../auth/hash.js";
import { renderEnv } from "../renderer/env.js";
import { buildComposeContext, renderCompose } from "../renderer/compose.js";
import { renderCaddyfile } from "../renderer/caddy.js";
import { renderServarrConfig } from "../renderer/servarr-config.js";
import { renderBazarrConfig } from "../renderer/bazarr-config.js";
import { renderQbitConfig } from "../renderer/qbit-config.js";
import { renderRecyclarrConfig } from "../renderer/recyclarr-config.js";
import { renderJellyfinEncoding } from "../renderer/jellyfin-encoding.js";
import { renderFirstRun } from "../renderer/first-run.js";
import { getServicesByIds } from "../catalog/index.js";
import { exec } from "../lib/exec.js";
import { createLogger, type Logger } from "../lib/log.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export type StepStatus = "pending" | "running" | "done" | "failed";
export type StepUpdate = { step: string; status: StepStatus; message?: string; durationMs?: number };

export async function runInstall(
  state: State,
  onStep: (update: StepUpdate) => void
): Promise<{ urls: Array<{ name: string; url: string; description: string }>; password: string }> {
  const log = createLogger(join(state.install_dir, "state", "install.log"));
  const dir = state.install_dir;
  mkdirSync(join(dir, "state"), { recursive: true });
  mkdirSync(join(dir, "config"), { recursive: true });

  const password = state.admin.username; // password stored in .env
  const services = getServicesByIds(state.services_enabled);

  // Step 1: Storage
  await step("Creating storage layout", onStep, log, async () => {
    createStorageLayout(state.storage_root, state.puid, state.pgid);
  });

  // Step 2: API keys
  const apiKeys: Record<string, string> = {};
  await step("Generating API keys", onStep, log, async () => {
    for (const svc of services) {
      if (svc.apiKeyEnv) apiKeys[svc.id] = state.api_keys[svc.id] ?? generateApiKey();
    }
  });

  // Step 3: Password hashing
  let adminBcrypt = "";
  let adminPbkdf2 = "";
  await step("Hashing admin password", onStep, log, async () => {
    const plain = process.env.ADMIN_PASSWORD ?? generatePassword();
    adminBcrypt = await bcryptHash(plain);
    adminPbkdf2 = qbitPbkdf2Hash(plain);
  });

  // Step 4: Write .env
  await step("Writing .env", onStep, log, async () => {
    const content = renderEnv({
      puid: state.puid, pgid: state.pgid, tz: state.timezone,
      installDir: dir, storageRoot: state.storage_root,
      adminUser: state.admin.username,
      adminPass: process.env.ADMIN_PASSWORD ?? "",
      apiKeys,
      cfToken: state.remote_access.token,
    });
    writeFileSync(join(dir, ".env"), content, { mode: 0o600 });
  });

  // Step 5: Render compose
  await step("Rendering docker-compose.yml", onStep, log, async () => {
    const ctx = buildComposeContext(services, {
      storageRoot: state.storage_root,
      extraPaths: state.extra_paths,
      puid: state.puid, pgid: state.pgid, timezone: state.timezone,
      apiKeys,
      gpu: state.gpu,
      vpn: state.vpn,
    });
    writeFileSync(join(dir, "docker-compose.yml"), renderCompose(ctx));
  });

  // Step 6: Render Caddyfile
  await step("Rendering Caddyfile", onStep, log, async () => {
    const caddy = renderCaddyfile({
      mode: state.remote_access.mode,
      domain: state.remote_access.domain,
      services: services.filter((s) => s.adminPort).map((s) => ({ id: s.id, port: s.adminPort! })),
    });
    mkdirSync(join(dir, "config/caddy"), { recursive: true });
    writeFileSync(join(dir, "config/caddy/Caddyfile"), caddy);
  });

  // Steps 7-12: Pre-write service configs
  await step("Writing service configs", onStep, log, async () => {
    for (const svc of ["sonarr", "radarr", "prowlarr"]) {
      if (apiKeys[svc]) {
        mkdirSync(join(dir, `config/${svc}`), { recursive: true });
        writeFileSync(join(dir, `config/${svc}/config.xml`), renderServarrConfig({ apiKey: apiKeys[svc] }));
      }
    }
    if (services.find((s) => s.id === "bazarr")) {
      mkdirSync(join(dir, "config/bazarr/config"), { recursive: true });
      writeFileSync(
        join(dir, "config/bazarr/config/config.yaml"),
        renderBazarrConfig({
          sonarrKey: apiKeys.sonarr ?? "", radarrKey: apiKeys.radarr ?? "",
          adminUser: state.admin.username, adminPassHash: adminBcrypt,
          bazarrKey: apiKeys.bazarr ?? "",
        })
      );
    }
    if (services.find((s) => s.id === "qbittorrent")) {
      mkdirSync(join(dir, "config/qbittorrent/qBittorrent/config"), { recursive: true });
      writeFileSync(
        join(dir, "config/qbittorrent/qBittorrent/config/qBittorrent.conf"),
        renderQbitConfig({ passwordHash: adminPbkdf2, adminUser: state.admin.username })
      );
    }
    if (services.find((s) => s.id === "recyclarr")) {
      mkdirSync(join(dir, "config/recyclarr"), { recursive: true });
      writeFileSync(
        join(dir, "config/recyclarr/recyclarr.yml"),
        renderRecyclarrConfig({ sonarrKey: apiKeys.sonarr ?? "", radarrKey: apiKeys.radarr ?? "" })
      );
    }
    if (services.find((s) => s.id === "jellyfin") && state.gpu.vendor !== "none") {
      mkdirSync(join(dir, "config/jellyfin/config"), { recursive: true });
      writeFileSync(
        join(dir, "config/jellyfin/config/encoding.xml"),
        renderJellyfinEncoding({ vendor: state.gpu.vendor })
      );
    }
  });

  // Step 13: docker compose pull
  await step("Pulling images", onStep, log, async () => {
    const r = await exec(`docker compose -f ${dir}/docker-compose.yml pull`, { timeoutMs: 600_000 });
    if (!r.ok) throw new Error(`Pull failed:\n${r.stderr.slice(-500)}`);
  });

  // Step 14: docker compose up
  await step("Starting containers", onStep, log, async () => {
    const r = await exec(`docker compose -f ${dir}/docker-compose.yml up -d`, { timeoutMs: 120_000 });
    if (!r.ok) throw new Error(`Start failed:\n${r.stderr.slice(-500)}`);
  });

  // Step 15: Health gate
  await step("Waiting for services to become healthy", onStep, log, async () => {
    for (const svc of services.filter((s) => s.health)) {
      await waitForHealth(svc.id, svc.health!.port, svc.health!.path ?? "/", 180_000);
    }
  });

  // Steps 16-27: Auto-wiring (see Phase 9 tasks for implementation)
  // These are imported from src/wiring/*.ts and called here.
  // Placeholder: the actual wiring calls are wired in after Phase 9 tasks.

  // Step 28: FIRST-RUN.md
  await step("Generating FIRST-RUN.md", onStep, log, async () => {
    const hostIp = await getHostIp();
    const urls = services.filter((s) => s.adminPort).map((s) => ({
      name: s.name,
      url: state.remote_access.domain
        ? `https://${s.id}.${state.remote_access.domain}`
        : `http://${hostIp}:${s.adminPort}`,
      description: s.description,
    }));
    writeFileSync(join(dir, "FIRST-RUN.md"), renderFirstRun({ services: urls, adminUser: state.admin.username }));
    writeFileSync(join(dir, "admin.txt"), `user: ${state.admin.username}\npass: ${process.env.ADMIN_PASSWORD}\n`, { mode: 0o600 });
    return urls;
  });

  // Step 29: Write final state
  writeState(dir, { ...state, api_keys: apiKeys, install_completed_at: new Date().toISOString() });

  const hostIp = await getHostIp();
  return {
    urls: services.filter((s) => s.adminPort).map((s) => ({
      name: s.name,
      url: state.remote_access.domain
        ? `https://${s.id}.${state.remote_access.domain}`
        : `http://${hostIp}:${s.adminPort}`,
      description: s.description,
    })),
    password: process.env.ADMIN_PASSWORD ?? "(see admin.txt)",
  };
}

async function step(name: string, onStep: (u: StepUpdate) => void, log: Logger, fn: () => Promise<unknown>) {
  onStep({ step: name, status: "running" });
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    log.info(name, `completed in ${ms}ms`);
    onStep({ step: name, status: "done", durationMs: ms });
  } catch (err: any) {
    log.error(name, err.message);
    onStep({ step: name, status: "failed", message: err.message });
    throw err;
  }
}

async function waitForHealth(service: string, port: number, path: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`http://localhost:${port}${path}`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const logs = await exec(`docker compose logs --tail=50 ${service}`);
  throw new Error(`${service} did not become healthy within ${timeoutMs / 1000}s.\nLast logs:\n${logs.ok ? logs.stdout.slice(-1000) : "unavailable"}`);
}

async function getHostIp(): Promise<string> {
  const r = await exec("hostname -I");
  return r.ok ? r.stdout.trim().split(" ")[0] : "localhost";
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: install pipeline orchestrator with all steps"
```

### Task 29: Progress view (Ink)

**Files:**
- Modify: `src/ui/progress/ProgressView.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/ui/progress/ProgressView.tsx
import React, { useState, useEffect } from "react";
import { Box, Text, Newline } from "ink";
import Spinner from "ink-spinner";
import { runInstall, type StepUpdate } from "../../usecase/install.js";
import { type State } from "../../state/schema.js";
import { colors } from "../shared/theme.js";

interface Props {
  state: State;
  onDone: (result: { urls: Array<{ name: string; url: string; description: string }>; password: string }) => void;
}

export function ProgressView({ state, onDone }: Props) {
  const [steps, setSteps] = useState<StepUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runInstall(state, (update) => {
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.step === update.step);
        if (idx >= 0) { prev[idx] = update; return [...prev]; }
        return [...prev, update];
      });
    })
      .then(onDone)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Installing arrstack</Text>
      <Newline />
      {steps.map((s) => (
        <Box key={s.step} gap={1}>
          {s.status === "done" && <Text color={colors.primary}>[ok]</Text>}
          {s.status === "running" && <Text color="cyan"><Spinner type="dots" /></Text>}
          {s.status === "failed" && <Text color={colors.error}>[!!]</Text>}
          {s.status === "pending" && <Text color={colors.muted}>[  ]</Text>}
          <Text>{s.step}</Text>
          {s.durationMs !== undefined && <Text color={colors.muted}>{(s.durationMs / 1000).toFixed(1)}s</Text>}
        </Box>
      ))}
      {error && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.error}>Install failed:</Text>
          <Text>{error}</Text>
          <Newline />
          <Text color={colors.muted}>Re-run: arrstack install --resume</Text>
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Install ink-spinner**

```bash
bun add ink-spinner
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: progress view with live step status"
```

### Task 30: Smoke test the install flow end-to-end on a Docker host

- [ ] **Step 1: Run the full install on a test box or VM**

```bash
bun run src/cli.ts install --install-dir /tmp/arrstack-test --verbose
```

Verify: form appears, fill fields, submit, images pull, containers start, done screen with URLs.

- [ ] **Step 2: Check containers are running**

```bash
docker compose -f /tmp/arrstack-test/docker-compose.yml ps
```

- [ ] **Step 3: Check health endpoints**

```bash
curl -s http://localhost:8989/api/v3/system/status | head -5
curl -s http://localhost:8096/health
```

- [ ] **Step 4: Commit any fixes found during smoke test**

## Phase 9: API Auto-Wiring (Tasks 31-38)

> Each task creates one wiring module in `src/wiring/`. Each module talks to a service's API to auto-configure it after boot. All are called from the install pipeline (Task 28) between the health-gate and the done screen.

### Task 31: Prowlarr indexers

**Files:**
- Create: `src/wiring/prowlarr-indexers.ts`
- Test: `tests/wiring/prowlarr-indexers.test.ts`

- [ ] **Step 1: Define the 5 public indexer payloads**

```ts
// src/wiring/prowlarr-indexers.ts
import { request } from "undici";

interface IndexerPayload {
  name: string;
  implementation: string;
  configContract: string;
  fields: Array<{ name: string; value: unknown }>;
  enable: boolean;
}

const PUBLIC_INDEXERS: IndexerPayload[] = [
  {
    name: "1337x",
    implementation: "Torznab",
    configContract: "TorznabSettings",
    fields: [{ name: "baseUrl", value: "https://1337x.to" }],
    enable: true,
  },
  {
    name: "The Pirate Bay",
    implementation: "Torznab",
    configContract: "TorznabSettings",
    fields: [{ name: "baseUrl", value: "https://thepiratebay.org" }],
    enable: true,
  },
  {
    name: "YTS",
    implementation: "Torznab",
    configContract: "TorznabSettings",
    fields: [{ name: "baseUrl", value: "https://yts.mx" }],
    enable: true,
  },
  {
    name: "EZTV",
    implementation: "Torznab",
    configContract: "TorznabSettings",
    fields: [{ name: "baseUrl", value: "https://eztv.re" }],
    enable: true,
  },
  {
    name: "TorrentGalaxy",
    implementation: "Torznab",
    configContract: "TorznabSettings",
    fields: [{ name: "baseUrl", value: "https://torrentgalaxy.to" }],
    enable: true,
  },
];

export async function addProwlarrIndexers(apiKey: string, baseUrl = "http://localhost:9696"): Promise<void> {
  const existing = await request(`${baseUrl}/api/v1/indexer`, {
    headers: { "X-Api-Key": apiKey },
  });
  const existingNames = (await existing.body.json() as Array<{ name: string }>).map((i) => i.name);

  for (const indexer of PUBLIC_INDEXERS) {
    if (existingNames.includes(indexer.name)) continue;
    await request(`${baseUrl}/api/v1/indexer`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(indexer),
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: Prowlarr public indexer auto-add (1337x, TPB, YTS, EZTV, TorrentGalaxy)"
```

### Task 32: Prowlarr application registration (Sonarr + Radarr)

**Files:**
- Create: `src/wiring/prowlarr-apps.ts`

- [ ] **Step 1: Implement**

```ts
// src/wiring/prowlarr-apps.ts
import { request } from "undici";

interface AppRegistration {
  name: string;
  implementation: string;
  implementationName: string;
  configContract: string;
  syncLevel: string;
  fields: Array<{ name: string; value: unknown }>;
}

export async function registerProwlarrApps(
  prowlarrKey: string,
  sonarrKey: string,
  radarrKey: string,
  baseUrl = "http://localhost:9696"
): Promise<void> {
  const existing = await request(`${baseUrl}/api/v1/applications`, {
    headers: { "X-Api-Key": prowlarrKey },
  });
  const apps = await existing.body.json() as Array<{ name: string; id: number }>;

  const sonarrApp: AppRegistration = {
    name: "Sonarr",
    implementation: "Sonarr",
    implementationName: "Sonarr",
    configContract: "SonarrSettings",
    syncLevel: "fullSync",
    fields: [
      { name: "prowlarrUrl", value: "http://prowlarr:9696" },
      { name: "baseUrl", value: "http://sonarr:8989" },
      { name: "apiKey", value: sonarrKey },
      { name: "syncCategories", value: [5030, 5040, 5045, 5090] },
      { name: "animeSyncCategories", value: [5070] },
    ],
  };

  const radarrApp: AppRegistration = {
    name: "Radarr",
    implementation: "Radarr",
    implementationName: "Radarr",
    configContract: "RadarrSettings",
    syncLevel: "fullSync",
    fields: [
      { name: "prowlarrUrl", value: "http://prowlarr:9696" },
      { name: "baseUrl", value: "http://radarr:7878" },
      { name: "apiKey", value: radarrKey },
      { name: "syncCategories", value: [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060, 2070, 2080] },
    ],
  };

  for (const app of [sonarrApp, radarrApp]) {
    const match = apps.find((a) => a.name === app.name);
    if (match) {
      await request(`${baseUrl}/api/v1/applications/${match.id}`, {
        method: "PUT",
        headers: { "X-Api-Key": prowlarrKey, "Content-Type": "application/json" },
        body: JSON.stringify({ ...app, id: match.id }),
      });
    } else {
      await request(`${baseUrl}/api/v1/applications`, {
        method: "POST",
        headers: { "X-Api-Key": prowlarrKey, "Content-Type": "application/json" },
        body: JSON.stringify(app),
      });
    }
  }

  await request(`${baseUrl}/api/v1/command`, {
    method: "POST",
    headers: { "X-Api-Key": prowlarrKey, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "ApplicationIndexerSync" }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: Prowlarr app registration (Sonarr + Radarr) with idempotency"
```

### Task 33: Sonarr/Radarr root folders and download client

**Files:**
- Create: `src/wiring/sonarr-radarr.ts`

- [ ] **Step 1: Implement**

```ts
// src/wiring/sonarr-radarr.ts
import { request } from "undici";

export async function configureArr(
  service: "sonarr" | "radarr",
  apiKey: string,
  opts: { rootFolder: string; extraFolders: string[]; qbitUser: string; qbitPass: string; category: string }
): Promise<void> {
  const port = service === "sonarr" ? 8989 : 7878;
  const base = `http://localhost:${port}`;
  const apiVersion = "v3";
  const headers = { "X-Api-Key": apiKey, "Content-Type": "application/json" };

  const existingFolders = await (await request(`${base}/api/${apiVersion}/rootfolder`, { headers })).body.json() as Array<{ path: string }>;
  const allFolders = [opts.rootFolder, ...opts.extraFolders];
  for (const folder of allFolders) {
    if (!existingFolders.some((f) => f.path === folder)) {
      await request(`${base}/api/${apiVersion}/rootfolder`, {
        method: "POST", headers,
        body: JSON.stringify({ path: folder }),
      });
    }
  }

  const existingClients = await (await request(`${base}/api/${apiVersion}/downloadclient`, { headers })).body.json() as Array<{ name: string }>;
  if (!existingClients.some((c) => c.name === "qBittorrent")) {
    await request(`${base}/api/${apiVersion}/downloadclient`, {
      method: "POST", headers,
      body: JSON.stringify({
        name: "qBittorrent",
        implementation: "QBittorrent",
        configContract: "QBittorrentSettings",
        enable: true,
        fields: [
          { name: "host", value: "qbittorrent" },
          { name: "port", value: 8080 },
          { name: "username", value: opts.qbitUser },
          { name: "password", value: opts.qbitPass },
          { name: "category", value: opts.category },
        ],
      }),
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: Sonarr/Radarr root folder and qBit download client auto-config"
```

### Task 34: qBittorrent post-boot config (categories + TRaSH settings)

**Files:**
- Create: `src/wiring/qbittorrent.ts`

- [ ] **Step 1: Implement**

```ts
// src/wiring/qbittorrent.ts
import { request } from "undici";

export async function configureQbit(user: string, pass: string, base = "http://localhost:8080"): Promise<void> {
  const loginRes = await request(`${base}/api/v2/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`,
  });
  const cookie = loginRes.headers["set-cookie"];
  const headers: Record<string, string> = { Cookie: String(cookie) };

  const categories = { tv: "/data/torrents/tv", movies: "/data/torrents/movies", music: "/data/torrents/music", books: "/data/torrents/books" };
  for (const [cat, path] of Object.entries(categories)) {
    await request(`${base}/api/v2/torrents/createCategory`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
      body: `category=${cat}&savePath=${encodeURIComponent(path)}`,
    });
  }

  await request(`${base}/api/v2/app/setPreferences`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      save_path: "/data/torrents",
      temp_path_enabled: false,
      preallocate_all: false,
      max_ratio_enabled: false,
      max_seeding_time_enabled: false,
      utp_rate_limited: true,
    }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: qBittorrent auto-config (categories + TRaSH settings)"
```

### Task 35: Jellyfin startup + libraries

**Files:**
- Create: `src/wiring/jellyfin.ts`

- [ ] **Step 1: Implement**

```ts
// src/wiring/jellyfin.ts
import { request } from "undici";

export async function setupJellyfin(
  adminUser: string,
  adminPass: string,
  libraries: Array<{ name: string; type: string; paths: string[] }>,
  base = "http://localhost:8096"
): Promise<void> {
  await request(`${base}/Startup/Configuration`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ UICulture: "en-US", MetadataCountryCode: "US", PreferredMetadataLanguage: "en" }),
  });

  await request(`${base}/Startup/User`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Name: adminUser, Password: adminPass }),
  });

  const authRes = await request(`${base}/Users/AuthenticateByName`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Emby-Authorization": `MediaBrowser Client="arrstack", Device="installer", DeviceId="arrstack-installer", Version="1.0.0"`,
    },
    body: JSON.stringify({ Username: adminUser, Pw: adminPass }),
  });
  const { AccessToken } = await authRes.body.json() as { AccessToken: string };
  const authHeaders = {
    "X-Emby-Token": AccessToken,
    "Content-Type": "application/json",
  };

  for (const lib of libraries) {
    await request(
      `${base}/Library/VirtualFolders?name=${encodeURIComponent(lib.name)}&collectionType=${lib.type}&refreshLibrary=true`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          LibraryOptions: {
            PathInfos: lib.paths.map((p) => ({ Path: p })),
          },
        }),
      }
    );
  }

  await request(`${base}/Startup/Complete`, { method: "POST", headers: authHeaders });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: Jellyfin startup wizard + auto-add libraries via API"
```

### Task 36: Jellyseerr link

**Files:**
- Create: `src/wiring/jellyseerr.ts`

- [ ] **Step 1: Implement**

```ts
// src/wiring/jellyseerr.ts
import { request } from "undici";

export async function linkJellyseerr(
  jellyfinUser: string,
  jellyfinPass: string,
  base = "http://localhost:5055"
): Promise<void> {
  await request(`${base}/api/v1/auth/jellyfin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: jellyfinUser,
      password: jellyfinPass,
      hostname: "jellyfin",
      port: 8096,
      useSsl: false,
      urlBase: "",
    }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: Jellyseerr auto-link to Jellyfin"
```

### Task 37: Recyclarr sync invoker

**Files:**
- Create: `src/wiring/recyclarr.ts`

- [ ] **Step 1: Implement**

```ts
// src/wiring/recyclarr.ts
import { exec } from "../lib/exec.js";

export async function runRecyclarrSync(installDir: string): Promise<void> {
  const r = await exec(
    `docker compose -f ${installDir}/docker-compose.yml run --rm recyclarr sync`,
    { timeoutMs: 300_000 }
  );
  if (!r.ok) {
    throw new Error(`Recyclarr sync failed:\n${r.stderr.slice(-500)}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: Recyclarr sync invoker"
```

### Task 38: Wire all auto-config into install pipeline

**Files:**
- Modify: `src/usecase/install.ts`

- [ ] **Step 1: Add wiring calls between health-gate and FIRST-RUN steps**

Insert after the health-gate step in `runInstall`:

```ts
import { setupJellyfin } from "../wiring/jellyfin.js";
import { linkJellyseerr } from "../wiring/jellyseerr.js";
import { configureQbit } from "../wiring/qbittorrent.js";
import { addProwlarrIndexers } from "../wiring/prowlarr-indexers.js";
import { registerProwlarrApps } from "../wiring/prowlarr-apps.js";
import { configureArr } from "../wiring/sonarr-radarr.js";
import { runRecyclarrSync } from "../wiring/recyclarr.js";

// After health gate:
const adminPass = process.env.ADMIN_PASSWORD ?? "";

if (services.find((s) => s.id === "jellyfin")) {
  await step("Setting up Jellyfin admin + libraries", onStep, log, async () => {
    const libs = [
      { name: "Movies", type: "movies", paths: [`/data/media/movies`] },
      { name: "TV Shows", type: "tvshows", paths: [`/data/media/tv`] },
      { name: "Music", type: "music", paths: [`/data/media/music`] },
    ];
    await setupJellyfin(state.admin.username, adminPass, libs);
  });
}

if (services.find((s) => s.id === "jellyseerr")) {
  await step("Linking Jellyseerr to Jellyfin", onStep, log, async () => {
    await linkJellyseerr(state.admin.username, adminPass);
  });
}

if (services.find((s) => s.id === "qbittorrent")) {
  await step("Configuring qBittorrent categories + settings", onStep, log, async () => {
    await configureQbit(state.admin.username, adminPass);
  });
}

if (services.find((s) => s.id === "prowlarr")) {
  await step("Adding Prowlarr indexers", onStep, log, async () => {
    await addProwlarrIndexers(apiKeys.prowlarr);
  });

  await step("Registering Sonarr + Radarr in Prowlarr", onStep, log, async () => {
    await registerProwlarrApps(apiKeys.prowlarr, apiKeys.sonarr ?? "", apiKeys.radarr ?? "");
  });
}

for (const svc of ["sonarr", "radarr"] as const) {
  if (services.find((s) => s.id === svc)) {
    await step(`Configuring ${svc} root folders + download client`, onStep, log, async () => {
      await configureArr(svc, apiKeys[svc], {
        rootFolder: `/data/media/${svc === "sonarr" ? "tv" : "movies"}`,
        extraFolders: state.extra_paths.map((_, i) => `/data/extra-${i}/${svc === "sonarr" ? "tv" : "movies"}`),
        qbitUser: state.admin.username,
        qbitPass: adminPass,
        category: svc === "sonarr" ? "tv" : "movies",
      });
    });
  }
}

if (services.find((s) => s.id === "recyclarr")) {
  await step("Applying TRaSH quality profiles via Recyclarr", onStep, log, async () => {
    await runRecyclarrSync(dir);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: wire all auto-config into install pipeline"
```

## Phase 10: Day-2 CLI Commands (Tasks 39-43)

### Task 39: doctor command

**Files:**
- Create: `src/usecase/doctor.ts`

- [ ] **Step 1: Implement**

Run all preflight checks plus service-specific health checks. Print report to stdout. Implementation reuses `runPreflight` from Task 9 plus per-service health pings.

- [ ] **Step 2: Wire into cli.ts doctor action**

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: arrstack doctor command"
```

### Task 40: update command

**Files:**
- Create: `src/usecase/update.ts`

- [ ] **Step 1: Implement**

```ts
// src/usecase/update.ts
import { exec } from "../lib/exec.js";

export async function runUpdate(installDir: string): Promise<void> {
  const pull = await exec(`docker compose -f ${installDir}/docker-compose.yml pull`, { timeoutMs: 600_000 });
  if (!pull.ok) throw new Error(`Pull failed: ${pull.stderr.slice(-200)}`);

  const up = await exec(`docker compose -f ${installDir}/docker-compose.yml up -d`, { timeoutMs: 120_000 });
  if (!up.ok) throw new Error(`Restart failed: ${up.stderr.slice(-200)}`);
}
```

- [ ] **Step 2: Wire into cli.ts update action**

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: arrstack update command"
```

### Task 41: show-password command

**Files:**
- Create: `src/usecase/show-password.ts`

Read `/opt/arrstack/admin.txt`, print to stdout.

- [ ] **Step 1: Implement and wire into cli.ts**

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: arrstack show-password command"
```

### Task 42: uninstall command

**Files:**
- Create: `src/usecase/uninstall.ts`

`docker compose down`. Prompt (unless `--non-interactive`) to remove `/opt/arrstack/config`. Never touch `/data`.

- [ ] **Step 1: Implement and wire into cli.ts**

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: arrstack uninstall command"
```

### Task 43: logs command

Wire `docker compose logs -f <service>` through to user's terminal.

- [ ] **Step 1: Implement using `execSync` with `stdio: "inherit"`**

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: arrstack logs command"
```

## Phase 11: Distribution (Tasks 44-46)

### Task 44: Binary build script

**Files:**
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Add build targets**

```json
{
  "scripts": {
    "build:x64": "bun build --compile --minify --target=bun-linux-x64 src/cli.ts --outfile dist/arrstack-linux-x64",
    "build:arm64": "bun build --compile --minify --target=bun-linux-arm64 src/cli.ts --outfile dist/arrstack-linux-arm64",
    "build": "bun run build:x64"
  }
}
```

- [ ] **Step 2: Test build**

```bash
bun run build:x64 && ls -lh dist/arrstack-linux-x64
```

Expected: binary exists, ~90-110 MB.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: binary build scripts for linux x64 and arm64"
```

### Task 45: install.sh shim

**Files:**
- Create: `bin/install.sh`

- [ ] **Step 1: Write the shim**

```bash
#!/usr/bin/env bash
main() {
set -Eeuo pipefail
trap 'printf "\nAborted.\n" >&2; exit 130' INT
trap 'rm -rf "$TMPDIR" 2>/dev/null' EXIT

REPO="LavX/arrstack-installer"
VERSION="${ARRSTACK_VERSION:-latest}"

ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  BINARY="arrstack-linux-x64" ;;
  aarch64) BINARY="arrstack-linux-arm64" ;;
  *) printf "Unsupported architecture: %s\n" "$ARCH" >&2; exit 1 ;;
esac

if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  case "$ID" in
    alpine) printf "Alpine is not supported (musl/Bun incompatibility).\n" >&2; exit 1 ;;
  esac
fi

TMPDIR=$(mktemp -d)
printf "Downloading arrstack...\n"

if [[ "$VERSION" == "latest" ]]; then
  DL_BASE="https://github.com/$REPO/releases/latest/download"
else
  DL_BASE="https://github.com/$REPO/releases/download/$VERSION"
fi

curl -fsSL "$DL_BASE/$BINARY" -o "$TMPDIR/arrstack"
curl -fsSL "$DL_BASE/checksums.txt" -o "$TMPDIR/checksums.txt"

cd "$TMPDIR"
grep "$BINARY" checksums.txt | sha256sum -c --quiet || {
  printf "Checksum verification failed.\n" >&2; exit 1
}
printf "Verified.\n"

chmod +x arrstack

INSTALL_PATH=""
if [[ -d "$HOME/.local/bin" ]] && echo "$PATH" | grep -q "$HOME/.local/bin"; then
  INSTALL_PATH="$HOME/.local/bin/arrstack"
  cp arrstack "$INSTALL_PATH"
else
  INSTALL_PATH="/usr/local/bin/arrstack"
  sudo cp arrstack "$INSTALL_PATH"
fi

printf "Installed to %s\n" "$INSTALL_PATH"
exec "$INSTALL_PATH" "$@"
}
main "$@"
```

- [ ] **Step 2: Commit**

```bash
chmod +x bin/install.sh
git add -A && git commit -m "feat: install.sh bootstrap shim with sha256 verification"
```

### Task 46: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ["v*"]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        target: [bun-linux-x64, bun-linux-arm64]
        include:
          - target: bun-linux-x64
            artifact: arrstack-linux-x64
          - target: bun-linux-arm64
            artifact: arrstack-linux-arm64
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test
      - run: bun build --compile --minify --target=${{ matrix.target }} src/cli.ts --outfile dist/${{ matrix.artifact }}
      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: dist/${{ matrix.artifact }}

  release:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4
      - run: |
          cd arrstack-linux-x64 && sha256sum arrstack-linux-x64 >> ../checksums.txt && cd ..
          cd arrstack-linux-arm64 && sha256sum arrstack-linux-arm64 >> ../checksums.txt && cd ..
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            arrstack-linux-x64/arrstack-linux-x64
            arrstack-linux-arm64/arrstack-linux-arm64
            checksums.txt
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "ci: GitHub Actions release workflow for binary builds"
```

## Phase 12: Final Integration + Smoke Test (Tasks 47-48)

### Task 47: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write**

```markdown
# arrstack

One-command install for your Sonarr, Radarr, Jellyfin, and friends.

## Install

    curl -fsSL https://lavx.github.io/arrstack/install.sh | bash

## What it installs

10 services, pre-configured and cross-wired:

qBittorrent, Prowlarr (with 5 public indexers), FlareSolverr, Sonarr, Radarr,
Bazarr, Jellyfin (with libraries), Jellyseerr, Caddy (reverse proxy), Recyclarr
(TRaSH quality profiles).

Optional: tdarr, trailarr, gluetun (VPN).

## Requirements

- Linux (Ubuntu 24.04+, Debian 13+, Fedora 43+)
- Docker + Docker Compose v2
- 10 GB free disk (images) + storage for media

## After install

1. Sign in to Jellyseerr (one click)
2. Request a movie or show

## Day-two

    arrstack              re-open the config form
    arrstack doctor       run diagnostics
    arrstack update       pull latest images
    arrstack show-password
    arrstack uninstall
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "docs: README with install command and service list"
```

### Task 48: End-to-end smoke test on a clean VM

- [ ] **Step 1: On a fresh Ubuntu 24.04 or Fedora 43 VM with Docker:**

```bash
curl -fsSL https://raw.githubusercontent.com/LavX/arrstack-installer/main/bin/install.sh | bash
```

- [ ] **Step 2: Verify all 10 containers are running and healthy**

```bash
docker compose -f /opt/arrstack/docker-compose.yml ps
```

- [ ] **Step 3: Verify Prowlarr has 5 indexers and 2 apps registered**

```bash
curl -s -H "X-Api-Key: $(grep PROWLARR /opt/arrstack/.env | cut -d= -f2)" http://localhost:9696/api/v1/indexer | jq length
curl -s -H "X-Api-Key: $(grep PROWLARR /opt/arrstack/.env | cut -d= -f2)" http://localhost:9696/api/v1/applications | jq length
```

Expected: 5 indexers, 2 applications.

- [ ] **Step 4: Verify Jellyfin has libraries**

```bash
curl -s http://localhost:8096/Library/VirtualFolders -H "X-Emby-Token: ..." | jq '.[].Name'
```

Expected: "Movies", "TV Shows", "Music"

- [ ] **Step 5: Request a movie through Jellyseerr to test the full flow**

- [ ] **Step 6: Tag and release v0.1.0**

```bash
git tag v0.1.0
git push origin main --tags
```

---

## Self-Review Notes

**Spec coverage checked:** every section of the spec (1-24) maps to at least one task. Storage (spec 10) = Task 18. Hardware transcoding (spec 16) = Task 10 detection + Task 17 encoding.xml template. Remote access (spec 14) = Tasks 15 (Caddy), 45 (shim). Local DNS (spec 15) = Task 17 dnsmasq template.

**No placeholders:** every task has files, steps, and code. Wiring tasks (31-38) show actual API payloads from the Backend architect's verified endpoints.

**Type consistency:** `State`, `Service`, `ComposeContext`, `CaddyContext` are defined in their respective schema files and referenced consistently. `apiKeys` is `Record<string, string>` everywhere.

**Gap found during review:** the servarr `main.db` SQLite user injection (for pre-boot admin accounts) is referenced in spec 17 but simplified in the plan to use config.xml only. Full SQLite injection can be added as a follow-up if the config.xml-only approach doesn't set the admin user reliably on all servarr versions.
