# arrstack-installer: Design

**Status:** draft (ready for review)
**Owner:** LavX
**Date:** 2026-04-16

## 1. Overview

`arrstack-installer` is a one-command installer and lightweight manager for a self-hosted media stack targeting Linux home servers. It is invoked via:

```bash
curl -fsSL https://lavx.github.io/arrstack/install.sh | bash
```

The bash shim downloads a verified static binary for the host's architecture and executes it. The binary presents a single-screen TUI form (built with Ink), collects configuration, then installs 10 Docker services with every admin panel pre-configured, pre-authenticated, and cross-wired. The user's remaining manual steps after install are: sign in to Jellyseerr once (one click, link already exists) and request a movie.

The project is a spiritual successor to the existing `bazarr-plus` installer at `/home/lavx/bazarr/site/install.sh`, extended from four services to ten with deep automation throughout.

## 2. Goals

1. `curl | bash` to a fully usable media stack in under 10 minutes on a fresh Linux box.
2. **Zero admin clicks after install.** Same admin user across every service, Jellyfin libraries auto-added, Prowlarr indexers and applications pre-registered, Sonarr/Radarr root folders and download client configured, Bazarr pre-linked, Jellyseerr pre-linked to Jellyfin, TRaSH quality profiles applied via Recyclarr.
3. Hardware transcoding auto-detected and configured for Intel QSV/VAAPI, AMD VAAPI, and NVIDIA NVENC.
4. Remote access that works for users with or without a domain: DuckDNS for free, Cloudflare for owned domains. Both with real Let's Encrypt TLS.
5. Multi-disk aware. Single storage root for TRaSH hardlinks, plus optional scan-only paths for existing libraries on additional drives.
6. Idempotent, reversible, obvious. Re-running the installer opens the same form pre-filled and shows a diff.
7. Zero runtime dependencies for the user. One binary, no interpreters.

## 3. Non-goals

- Windows, macOS.
- Kubernetes, swarm, multi-host.
- Custom service authoring in v1 (catalog is curated).
- General-purpose homelab platform (CasaOS, Runtipi, Umbrel niche).
- Media content curation beyond what TRaSH profiles cover.

## 4. Technology stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript (strict) | Comfortable for the owner, best-in-class TUI via Ink |
| TUI framework | Ink (React for terminals) | Same model as Vercel CLI, Gemini CLI, Claude Code |
| Runtime | Bun | `bun build --compile` produces single static binary with runtime embedded |
| CLI dispatcher | commander | Subcommand routing |
| HTTP | undici | Native fetch, retries |
| Templates | handlebars | Compose, Caddyfile, recyclarr.yml, config.xml generation |
| Schemas | zod | State + catalog validation |
| Hashing | bcryptjs, node:crypto | bcrypt for servarr users, PBKDF2 for qBittorrent |
| Packaging | `bun build --compile` | One file per arch (linux-x64, linux-arm64) |
| Verification | sha256 (no cosign in v1) | Realistic bar for homelab |
| Release | GitHub Releases + Pages-hosted shim | Tailscale pattern |

## 5. Scope

Single v1 release. No v1.1/v1.2 roadmap baked in; iteration happens post-launch based on actual user feedback.

### 5.1 Services in v1

**Core (shipped on by default, 10 services):**

1. qBittorrent (download client)
2. Prowlarr (indexer manager)
3. FlareSolverr (Cloudflare challenge solver for Prowlarr)
4. Sonarr (TV show manager)
5. Radarr (movie manager)
6. Bazarr (subtitle manager)
7. Jellyfin (media server)
8. Jellyseerr (request manager)
9. Caddy (reverse proxy with internal CA for LAN, Let's Encrypt for remote)
10. Recyclarr (syncs TRaSH quality profiles to Sonarr/Radarr)

**Opt-in (checkbox in wizard):**

- tdarr (bulk transcoding)
- trailarr (trailer downloader)
- gluetun (VPN namespace for qBittorrent)

**Auto-added based on user choices:**

- cloudflare-ddns (if Cloudflare remote-access mode selected)
- duckdns-updater (if DuckDNS mode selected)
- dnsmasq (if local DNS opted in)

### 5.2 Explicit non-features in v1

- Dashboard TUI. Re-running the wizard form is the dashboard.
- Cosign keyless binary verification. sha256 is the realistic bar.
- `/etc/docker/daemon.json` mutation. Per-service `logging:` in compose is equivalent.
- Resumable state machine. Re-run is idempotent.
- Diagnostic bundle tar.gz. Print last 50 log lines on failure is enough.
- sops+age secrets. `.env` mode 600 is enough.
- Bundled AdGuardHome or CoreDNS. dnsmasq opt-in only for local DNS.
- Host networking everywhere. Bridge with explicit ports instead.
- Digest-pinned images by default. Pin to tags; users opt into digest pinning.

## 6. Distribution and bootstrap

### 6.1 Release artifacts per tag

```
arrstack-linux-x64
arrstack-linux-arm64
checksums.txt
install.sh            # shim, mirrored to GitHub Pages
```

### 6.2 Install shim (~80 LOC bash)

Hosted at `https://lavx.github.io/arrstack/install.sh`:

1. Wrap body in `main()`, call on last line. Protects against truncated pipe.
2. `set -Eeuo pipefail`, `trap cleanup ERR EXIT INT TERM`.
3. Detect arch via `uname -m` (x86_64, aarch64 supported; else fail).
4. Parse `/etc/os-release` for distro sanity check. Refuse Alpine; warn non-Tier-1.
5. Download arch-specific binary plus `checksums.txt` to a tempdir.
6. `sha256sum -c` to verify.
7. Install to `~/.local/bin/arrstack` if that directory is on `PATH`, else `/usr/local/bin/arrstack` via one-shot sudo.
8. `exec arrstack`.

No sudo used by the shim except the final `/usr/local/bin` copy.

### 6.3 In-binary bootstrap

1. Show host info banner (hostname, distro, kernel).
2. Run pre-flight checks (green-check list).
3. Auto-detect GPU, render/video GIDs.
4. Launch the one-screen wizard form.

## 7. Module layout

```
arrstack/
├── src/
│   ├── cli.ts                       # commander dispatch
│   ├── catalog/
│   │   ├── services.yaml            # canonical 13-service catalog
│   │   └── index.ts                 # zod-typed loader
│   ├── state/
│   │   ├── schema.ts                # State zod schema, schema_version
│   │   ├── store.ts                 # read/write /opt/arrstack/state.json
│   │   └── migrations/
│   ├── storage/
│   │   └── layout.ts                # create /data/{torrents,media}/{tv,movies,music,books}
│   ├── renderer/
│   │   ├── compose.ts               # emit docker-compose.yml
│   │   ├── caddy.ts                 # emit Caddyfile (LAN + remote modes)
│   │   ├── recyclarr.ts             # emit recyclarr.yml
│   │   ├── dnsmasq.ts               # emit dnsmasq.conf
│   │   ├── jellyfin-encoding.ts     # emit encoding.xml with hwaccel config
│   │   └── servarr-config.ts        # emit Sonarr/Radarr/Prowlarr config.xml
│   ├── platform/
│   │   ├── distro.ts                # /etc/os-release parse
│   │   ├── docker.ts                # detect, install, `sg docker -c ...`
│   │   ├── gpu.ts                   # lspci + /dev/dri + nvidia-smi
│   │   ├── groups.ts                # render/video GID resolution
│   │   ├── preflight.ts             # blocking + informational checks
│   │   └── ports.ts                 # port-in-use detection
│   ├── auth/
│   │   ├── servarr.ts               # bcrypt User row for sonarr/radarr/prowlarr
│   │   ├── qbittorrent.ts           # PBKDF2 hash for qBittorrent.conf
│   │   ├── bazarr.ts                # bcrypt for config.yaml auth
│   │   ├── jellyfin.ts              # /Startup/User + /Startup/Configuration
│   │   └── jellyseerr.ts            # /api/v1/auth/jellyfin link
│   ├── wiring/
│   │   ├── prowlarr.ts              # add indexers + register Sonarr+Radarr apps
│   │   ├── sonarr-radarr.ts         # root folders, download client, naming
│   │   ├── jellyfin-libraries.ts    # POST /Library/VirtualFolders
│   │   ├── bazarr-integration.ts    # sonarr+radarr sections in config.yaml
│   │   ├── qbittorrent-config.ts    # categories, advanced settings via API
│   │   └── recyclarr-sync.ts        # run recyclarr sync container
│   ├── remote/
│   │   ├── cloudflare.ts            # cloudflare-ddns container + Caddy CF DNS-01
│   │   └── duckdns.ts               # duckdns updater + Caddy DuckDNS DNS-01
│   ├── usecase/
│   │   ├── install.ts               # full install pipeline
│   │   ├── update.ts                # docker compose pull + up -d, re-apply wiring
│   │   ├── doctor.ts                # diagnostic checks
│   │   ├── uninstall.ts             # data-preserving by default
│   │   └── show-password.ts         # reprint admin creds
│   ├── ui/
│   │   ├── App.tsx                  # Ink root, wizard vs reconfigure branching
│   │   ├── wizard/
│   │   │   ├── Form.tsx             # the one-screen form
│   │   │   ├── StorageField.tsx
│   │   │   ├── AdminField.tsx
│   │   │   ├── GpuField.tsx
│   │   │   ├── ServicesField.tsx
│   │   │   ├── RemoteAccessField.tsx
│   │   │   ├── LocalDnsField.tsx
│   │   │   ├── SystemField.tsx
│   │   │   └── StatusStrip.tsx
│   │   ├── progress/
│   │   │   └── ProgressView.tsx
│   │   ├── done/
│   │   │   └── DoneScreen.tsx
│   │   └── shared/
│   │       ├── theme.ts
│   │       ├── Checkbox.tsx
│   │       ├── Radio.tsx
│   │       └── Input.tsx
│   └── lib/
│       ├── exec.ts                  # child_process with timeout
│       ├── retry.ts                 # exponential backoff
│       ├── docker.ts                # `docker compose` wrapper, `docker ps --format`
│       ├── log.ts                   # structured to install.log
│       └── random.ts                # password + API key generation
├── templates/
│   ├── compose.yml.hbs
│   ├── Caddyfile.hbs
│   ├── FIRST-RUN.md.hbs
│   ├── recyclarr.yml.hbs
│   ├── jellyfin-encoding.xml.hbs
│   ├── qbittorrent.conf.hbs
│   ├── servarr-config.xml.hbs
│   └── dnsmasq.conf.hbs
├── bin/install.sh                    # curl|bash shim
├── package.json
├── tsconfig.json
└── .github/workflows/release.yml
```

Dependency direction: `ui` and `cli` depend on `usecase`. `usecase` depends on `renderer`, `auth`, `wiring`, `remote`, `platform`, `storage`, `state`. `catalog` is leaf data.

## 8. Data model

### 8.1 Service catalog

`catalog/services.yaml` holds canonical definitions. Each entry includes:

- `id`, `name`, `description`
- `category` (download | indexer | arr | media | request | proxy | dns | ddns | hwaccel | utility)
- `image` and default `tag`
- `ports` exposed on bridge
- `admin_port` for Caddy routing
- `mounts` to bind
- `env_vars` for compose
- `depends_on`
- `health` (HTTP endpoint to poll)
- `default` (pre-checked in wizard)
- `requires_admin_auth`
- `hwaccel_support`

### 8.2 State file

`/opt/arrstack/state.json`:

```ts
const StateSchema = z.object({
  schema_version: z.literal(1),
  installer_version: z.string(),
  install_started_at: z.string().datetime(),
  install_completed_at: z.string().datetime().optional(),
  install_dir: z.string(),
  storage_root: z.string(),
  extra_paths: z.array(z.string()),
  admin: z.object({
    username: z.string(),
  }),
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
  }),
  local_dns: z.object({ enabled: z.boolean(), tld: z.string() }),
  vpn: z.object({ enabled: z.boolean(), provider: z.string().optional() }),
  timezone: z.string(),
  puid: z.number(),
  pgid: z.number(),
  api_keys: z.record(z.string(), z.string()),
  last_updated_at: z.string().datetime().optional(),
});
```

The state file is the source of truth for "what is installed." Generated compose, Caddyfile, etc. are outputs. `arrstack doctor` reconciles state vs. `docker ps`.

## 9. User experience

### 9.1 The one-screen wizard

A single Ink form, scrollable if the terminal is short. Form-style review with all fields visible and defaults pre-filled, not sequential-screen wizard. Keybinds:

- Tab / Shift-Tab: next / previous field
- Arrows: change radio selection, move within a field group
- Space: toggle checkbox
- Enter on text input: commit value
- Enter on `[Install]`: proceed
- `?`: help overlay
- Esc or `q`: cancel (confirm)

Layout sections, top to bottom:

- **STORAGE**: `storage root` text input, `additional scan-only paths` (comma-separated).
- **ADMIN ACCOUNT**: username + password, with regenerate-password button.
- **HARDWARE TRANSCODING**: detected GPU name displayed; radio for None / Intel QSV / AMD VAAPI / NVIDIA NVENC, only supported options enabled.
- **SERVICES**: checkbox grid, 3 columns, defaults per catalog.
- **REMOTE ACCESS**: radio (None / DuckDNS / Cloudflare); dynamic fields appear below the active selection.
- **LOCAL HOSTNAMES**: single checkbox `Install local DNS`, TLD text input.
- **SYSTEM**: timezone (auto-detected), PUID/PGID (auto-detected), VPN radio.
- **STATUS STRIP**: live disk-free per path, Docker ok/fail, port 80/443 free.
- **ACTIONS**: `[Install]` / `[Save & exit]` / `[Cancel]`.

### 9.2 Reconfigure mode

When `arrstack` runs on an existing install, the same form loads pre-filled from `state.json`. The primary action button changes to `[Apply changes]`, and the status strip is replaced with a diff summary (e.g., "adding tdarr, removing bazarr, 2 paths changed"). Same keybinds.

### 9.3 Progress view

Single line per step. No raw docker output unless `--verbose`:

```
  [ok]  pre-flight passed                         0.8s
  [ok]  /opt/arrstack and /data tree created      0.1s
  [ok]  .env written                              0.1s
  [ok]  docker-compose.yml rendered               0.2s
  [ok]  Caddyfile rendered                        0.1s
  [..]  pulling images (4 of 10)                  2m 14s
  [  ]  starting containers
  [  ]  waiting for services to become healthy
  [  ]  configuring admin accounts
  [  ]  wiring services together
  [  ]  applying TRaSH quality profiles
  [  ]  adding Jellyfin libraries
```

### 9.4 Done screen

```
arrstack is running.

Admin credentials (shown once; also saved to /opt/arrstack/admin.txt mode 600):
  user: admin
  pass: k3d4-W2q8-Xyzv-9pRt

Open in browser (all pre-signed in with the above):

  Jellyfin      https://jellyfin.arr.lavx.hu
  Jellyseerr    https://requests.arr.lavx.hu
  Sonarr        https://sonarr.arr.lavx.hu
  Radarr        https://radarr.arr.lavx.hu
  Prowlarr      https://prowlarr.arr.lavx.hu
  Bazarr        https://bazarr.arr.lavx.hu
  qBittorrent   https://qbit.arr.lavx.hu

Remaining steps:
  1. Sign in to Jellyseerr (one click, already linked to Jellyfin)
  2. Request a movie or show

Day-two commands:
  arrstack                 re-open the form to add/remove services
  arrstack doctor          run diagnostics
  arrstack update          pull latest images and re-apply wiring
  arrstack show-password   reprint admin credentials
  arrstack uninstall       stop the stack; keeps /data untouched
```

## 10. Storage layout

TRaSH-compliant single-filesystem layout is mandatory for hardlinks. The installer creates and enforces:

```
<storage_root>/
├── torrents/
│   ├── tv
│   ├── movies
│   ├── music
│   └── books
└── media/
    ├── tv
    ├── movies
    └── music
```

Default `storage_root`: `/data`. User can override in the wizard.

**Multi-disk:** extra scan-only paths are bind-mounted read-write into Sonarr/Radarr and added as additional root folders. Hardlinks only work within the primary storage root; files on additional drives are imported from their existing location (Sonarr/Radarr handle this gracefully via "Unmapped Folders").

**Container mount map:**

| Service | Mount | Mode |
|---|---|---|
| qBittorrent | `storage_root/torrents` → `/data/torrents` | rw |
| Sonarr, Radarr | `storage_root` → `/data`; extras → `/data/extra-<n>` | rw |
| Bazarr | `storage_root/media` → `/data/media` | rw |
| Jellyfin | `storage_root/media` plus extras → `/media/...` | ro |
| Tdarr (opt-in) | `storage_root/media` | rw |

Only mounting `/data` into the arrs (not `/media`, not `/movies`, not `/tv`) is what TRaSH-Guides requires for hardlinks to work.

## 11. Pre-flight checks

**Blocking (5):**

1. Linux x86_64 or aarch64
2. Docker installed and running
3. docker compose v2 available
4. Free space on `/` ≥ 10 GB; on `storage_root` ≥ 50 GB (warn under 500 GB)
5. Ports 80, 443 free (warn; offer to remap Caddy)

**Informational, surfaced in `arrstack doctor`:**

- GPU detection and render/video GIDs
- systemd-resolved on port 53 (only matters when local DNS is opted in)
- cgroup v2 active
- Existing Docker stacks (by compose project label)
- User in docker group or running with sudo
- Time sync
- Kernel ≥ 5.10

## 12. Install pipeline

Sequence after wizard submit:

1. Create `storage_root/{torrents,media}/{tv,movies,music,books}` with PUID:PGID ownership.
2. Generate random API keys (32-char hex) per arr service.
3. Hash admin password: bcrypt for servarrs and Bazarr, PBKDF2 for qBittorrent. Store plaintext copy in `.env` for Jellyfin `/Startup/User` API call and for `arrstack show-password`.
4. Write `.env` (mode 600, user-owned).
5. Render `docker-compose.yml` from catalog plus state.
6. Render `Caddyfile` based on remote-access mode and enabled services.
7. Render `qBittorrent.conf` with PBKDF2 hash and TRaSH settings.
8. Pre-write servarr `config.xml` files and inject bcrypt'd User row into `main.db`.
9. Pre-write Bazarr `config.yaml` with admin auth and sonarr/radarr sections.
10. Render `recyclarr.yml`.
11. Render Jellyfin `encoding.xml` with hwaccel config per detected GPU vendor.
12. If local DNS opted in: render `dnsmasq.conf`.
13. `docker compose pull`.
14. `docker compose up -d`.
15. Wait for each service's health endpoint to return 200 (timeout 180 s per service; print last 50 log lines on fail).
16. Call Jellyfin `/Startup/Configuration` with language and metadata country (derived from timezone).
17. Call Jellyfin `/Startup/User` with admin username and password.
18. Authenticate with newly-created admin, obtain access token.
19. `POST /Library/VirtualFolders` for each library (Movies, TV, Music) with primary and extra paths.
20. `POST /api/v1/auth/jellyfin` on Jellyseerr to complete the admin link.
21. `POST /api/v1/settings/jellyfin/library` on Jellyseerr to enable imported libraries.
22. Apply qBittorrent categories and TRaSH advanced settings via API.
23. `POST` 5 public indexers to Prowlarr via `/api/v1/indexer`.
24. `POST` Sonarr and Radarr as applications to Prowlarr via `/api/v1/applications`.
25. Trigger Prowlarr `/api/v1/command` `ApplicationIndexerSync` to push indexers to Sonarr and Radarr.
26. Configure Sonarr and Radarr: root folders, qBittorrent as download client with admin credentials, TRaSH naming scheme.
27. Run `docker compose run --rm recyclarr sync` to apply TRaSH quality profiles.
28. Generate `FIRST-RUN.md` from template.
29. Write `/opt/arrstack/admin.txt` (mode 600).
30. Present done screen.

Each step is idempotent. Re-running the installer re-evaluates each step; steps that find their target already configured skip.

On any step failure: print last 50 log lines of the relevant container, log the error to `/opt/arrstack/state/install.log`, exit non-zero. User retries with `arrstack install --resume` (continue from failed step) or `arrstack install --fresh` (wipe config, preserve `/data/media`, start over).

## 13. Networking

All services join a user-defined bridge network `arrstack`. Services address each other via docker DNS (e.g., `http://sonarr:8989`). Ports are published on the host (`0.0.0.0`) per service for direct LAN access. Caddy listens on host `80/443` routing by Host header for friendly URLs when a remote-access mode or local DNS is enabled.

Exceptions to bridge networking:

- qBittorrent plus Gluetun (opt-in): when VPN is enabled, qBittorrent uses `network_mode: service:gluetun`.
- Jellyfin DLNA: user can optionally enable host-port publish for UDP 1900 and UDP 7359 (wizard note, default off).

## 14. Remote access modes

### 14.1 None (LAN only)

No DDNS container, no public-domain Caddy block. Caddy still runs for LAN Host-header routing and internal-CA TLS if local DNS is enabled.

### 14.2 DuckDNS

`duckdns-updater` container updates the A record every 5 minutes. Caddy configured with `caddy-dns/duckdns` plugin. Let's Encrypt cert via DNS-01 for `*.<subdomain>.duckdns.org`. Subdomain routing: `sonarr.<subdomain>.duckdns.org` → `sonarr:8989`.

### 14.3 Cloudflare (user-owned domain)

`cloudflare-ddns` container updates A record every 5 minutes. Caddy configured with `caddy-dns/cloudflare` plugin. Let's Encrypt wildcard cert via DNS-01. Subdomain routing: `sonarr.arr.<domain>` → `sonarr:8989`.

### 14.4 Caddy image

Installer ships a prebuilt Caddy image `ghcr.io/lavx/arrstack-caddy:v1` that includes both `caddy-dns/cloudflare` and `caddy-dns/duckdns` plugins. This avoids xcaddy at install time.

## 15. Local DNS (opt-in)

If enabled: `dnsmasq` container binds host port 53 with `address=/<tld>/<host-ip>` wildcard. Pre-flight detects systemd-resolved on port 53 and, if found, prompts:

```
systemd-resolved holds port 53.
Installing local DNS needs resolved to listen on 127.0.0.53 only.
This is a one-line edit to /etc/systemd/resolved.conf (DNSStubListener=no).
Apply this change? [y/N]
```

If user declines, opt out of local DNS and proceed without it.

Caddy's internal CA issues certs for `<tld>` hostnames (default `arrstack.local`). User needs to trust Caddy's root CA on their devices (one-time per device). Installer prints the trust-root install instructions and saves `caddy-root.crt` to `/opt/arrstack/` for easy copying.

## 16. Hardware transcoding

### 16.1 Detection

1. `lspci -nn | grep -Ei 'vga|3d|display'` to enumerate GPUs with vendor IDs.
2. If Intel or AMD vendor and `/dev/dri/renderD128` exists: VAAPI candidate.
3. If NVIDIA vendor and `nvidia-smi` works: NVENC candidate.
4. If NVIDIA candidate: check `docker info --format '{{json .Runtimes}}'` for `nvidia` runtime.
5. Resolve render/video GIDs via `getent group render` / `getent group video`. Fallback to `stat -c '%g' /dev/dri/renderD128`.

### 16.2 Wizard

Radio presents only supported options:

- CPU only (always available)
- Intel QSV / VAAPI (if Intel detected)
- AMD VAAPI (if AMD detected)
- NVIDIA NVENC (if NVIDIA plus toolkit detected)
- NVIDIA NVENC + install toolkit (if NVIDIA detected but no toolkit)

### 16.3 Compose generation per selection

**Intel / AMD VAAPI:**

```yaml
jellyfin:
  devices:
    - /dev/dri:/dev/dri
  group_add:
    - "${RENDER_GID}"
    - "${VIDEO_GID}"
```

**NVIDIA NVENC:**

```yaml
jellyfin:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu, video]
```

### 16.4 Jellyfin encoding.xml

Pre-written with `<HardwareAccelerationType>` set to `vaapi` or `nvenc` and appropriate `<VaapiDevice>` or NVENC capabilities. Same hwaccel block applied to tdarr and trailarr if selected.

### 16.5 NVIDIA toolkit install

If user picks "install toolkit":

```
<distro-specific> install nvidia-container-toolkit
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker
```

Installer prompts for sudo once before proceeding. This is the only case where the installer restarts docker, and only when the user explicitly opts in.

## 17. Admin account

Single username and password applied to every service that has user authentication.

| Service | Method |
|---|---|
| Sonarr, Radarr, Prowlarr | Pre-write `config.xml` with `<AuthenticationMethod>Forms</AuthenticationMethod>` and `<AuthenticationRequired>Enabled</AuthenticationRequired>`. Insert bcrypt'd User row into `main.db` SQLite before first boot. |
| Bazarr | Pre-write `config.yaml` with `auth.type: basic` and bcrypt'd password. |
| qBittorrent | Pre-write `qBittorrent.conf` with `WebUI\Password_PBKDF2="@ByteArray(<hash>)"`. |
| Jellyfin | After boot, POST `/Startup/User` and `/Startup/Configuration`. |
| Jellyseerr | After Jellyfin, POST `/api/v1/auth/jellyfin` with admin creds. |
| tdarr | Env var (when supported) or config file. |
| trailarr | Env var or config file. |
| FlareSolverr, Caddy, Recyclarr, DDNS containers, dnsmasq | No UI, no auth. |

Password is generated (24-char, alphanumeric with dashes) unless user types their own. Minimum: 12 characters enforced by Sonarr v4.

Stored in:

- `/opt/arrstack/.env` (mode 600, used by compose and by installer for API calls).
- `/opt/arrstack/admin.txt` (mode 600, human-readable, for `arrstack show-password`).

## 18. Per-service auto-configuration

### 18.1 qBittorrent

After container is healthy and admin login succeeds, POST to qBit Web API:

- Create 4 categories: `tv`, `movies`, `music`, `books`, each with `savePath: /data/torrents/<cat>`.
- Set default save path to `/data/torrents`.
- Apply TRaSH settings:
  - Disable seeding limits (managed by arr apps).
  - Disable preallocation.
  - Torrent file handling: Original.
  - No incomplete downloads folder (prevents extra move).
  - Enable uTP rate limits.

### 18.2 Prowlarr

- Pre-seed API key via `PROWLARR__AUTH__APIKEY`.
- After boot, POST 5 public indexers via `/api/v1/indexer`: 1337x, The Pirate Bay, YTS, EZTV, TorrentGalaxy.
- POST Sonarr as application: `POST /api/v1/applications` with
  `{name: "Sonarr", implementation: "Sonarr", implementationName: "Sonarr", configContract: "SonarrSettings", syncLevel: "fullSync", fields: [{prowlarrUrl, baseUrl: "http://sonarr:8989", apiKey: <sonarr_key>, syncCategories: [5030,5040,5045,5090], animeSyncCategories: [5070]}]}`.
- POST Radarr as application with movie categories `[2000,2010,2020,2030,2035,2040,2045,2050,2060,2070,2080,2090]`.
- Before POST, `GET /api/v1/applications` and skip if already registered with matching fields; PUT if fields differ.
- Trigger `POST /api/v1/command` with `{name: "ApplicationIndexerSync"}`.

### 18.3 Sonarr and Radarr

- Pre-seeded API keys via `SONARR__AUTH__APIKEY` / `RADARR__AUTH__APIKEY`.
- After boot, POST:
  - Root folders: `/data/media/tv` (Sonarr) and `/data/media/movies` (Radarr). Extra scan paths added as additional root folders.
  - Download client: qBittorrent at `qbittorrent:8080` with admin credentials, `tv` category for Sonarr, `movies` for Radarr.
  - Naming scheme per TRaSH (standard episode format for Sonarr, standard movie format for Radarr).

### 18.4 Bazarr

Pre-written `config.yaml` before first boot with:

- `auth.type: basic`, bcrypt'd admin password.
- `general.use_sonarr: true`, `general.use_radarr: true`.
- `sonarr.ip: sonarr`, `sonarr.port: 8989`, `sonarr.apikey: <sonarr_key>`, `sonarr.ssl: false`, `sonarr.full_update: Daily`.
- Equivalent `radarr:` block.
- Enabled providers: `opensubtitles`, `opensubtitlescom` (credentials optional, user adds later), `podnapisi`, `embeddedsubtitles`.

### 18.5 Jellyfin

- POST `/Startup/Configuration` with language (default en-US) and preferred metadata country (derived from timezone).
- POST `/Startup/User` with admin username and password.
- Authenticate with admin to obtain access token.
- For each library (Movies, TV, Music), POST `/Library/VirtualFolders?name=<n>&collectionType=<t>&refreshLibrary=true` with body:

  ```json
  {
    "LibraryOptions": {
      "PathInfos": [
        {"Path": "/data/media/movies"},
        {"Path": "/mnt/hdd1/movies"},
        {"Path": "/mnt/hdd3/movies"}
      ]
    }
  }
  ```

- Jellyfin kicks off library scan automatically.

### 18.6 Jellyseerr

- After Jellyfin is ready, POST `/api/v1/auth/jellyfin` with `{username: admin, password: <plain>, hostname: "jellyfin", port: 8096, useSsl: false}`.
- Jellyseerr validates, stores the link. User's next visit shows "Sign in with Jellyfin" as a one-click action.
- POST `/api/v1/settings/jellyfin/library` to enable the imported libraries.

### 18.7 Recyclarr

- Pre-written `recyclarr.yml` referencing Sonarr and Radarr with their API keys.
- Default profiles:
  - Sonarr: `WEB-1080p`, `WEB-2160p`, `anime-remux-1080p`
  - Radarr: `HD Bluray + WEB`, `UHD Bluray + WEB`
- Installer runs `docker compose run --rm recyclarr sync` once.
- Container remains available for scheduled or manual re-syncs. FIRST-RUN.md explains how to re-sync.

## 19. Security

- `.env` file mode 600, owned by invoking user.
- Cloudflare or DuckDNS tokens stored in `.env` only.
- Cloudflare token scope recommendation printed in FIRST-RUN.md: `Zone:DNS:Edit`, `Zone:Zone:Read`, zone-scoped to the specific domain.
- All services run with `PUID`/`PGID` set to non-root; installer warns and requires `--allow-root-puid` flag to proceed with `PUID=0`.
- sha256 binary verification at bootstrap; no cosign in v1.
- Image tags pinned in catalog (specific major/minor). Users opt into digest pinning via `arrstack update --pin-digests` (which freezes to the current digests).
- `arrstack update` is the recommended patch-velocity path: every 2025-2026 notable arr-stack CVE was fixed by a version bump, and `update` pulls the latest tag and re-applies wiring.

## 20. Reliability

- Each step in the install pipeline is idempotent.
- On any step failure: last 50 log lines of the relevant container printed to stderr. `install.log` (structured JSON, one event per line) at `/opt/arrstack/state/install.log`. User told to re-run `arrstack install --resume` (continue from failed step) or `arrstack install --fresh` (wipe `/opt/arrstack/config`, keep `/data/media`, restart).
- `arrstack doctor` runs all blocking pre-flight checks plus informational checks, pings each service's health endpoint, validates file permissions on critical paths.
- No `/etc/docker/daemon.json` mutation. Per-service `logging: {driver: json-file, options: {max-size: "50m", max-file: "3"}}` in compose provides log rotation. This is the direct fix for the jellyfin-filled-the-disk outage that motivated this project.

## 21. CLI surface

```
arrstack                      auto: wizard if no state, reconfigure form otherwise
arrstack install              force wizard
arrstack install --fresh      wipe /opt/arrstack/config, keep /data/media, start over
arrstack install --resume     resume from last failed step
arrstack update               pull latest images, restart, re-run wiring
arrstack update --pin-digests freeze current image digests into images.lock
arrstack doctor               all checks
arrstack show-password        reprint admin creds
arrstack logs <service>       tail a service
arrstack uninstall            docker compose down; leave /data; prompt to purge /opt/arrstack/config
arrstack --version
arrstack --help
```

Global flags: `--install-dir`, `--non-interactive`, `--verbose`, `--dry-run`, `--allow-root-puid`.

## 22. Build and release

GitHub Actions matrix (`ubuntu-latest`, arch: `[x64, arm64]`):

1. Install Bun.
2. `bun install`.
3. `bun test`.
4. `bun run lint`.
5. `bun build --compile --minify --target=bun-linux-<arch> src/cli.ts --outfile dist/arrstack-linux-<arch>`.

After matrix:

1. Compute `checksums.txt` (sha256 per binary).
2. Publish GitHub Release with binaries plus checksums.
3. Deploy `install.sh` to GitHub Pages at `/arrstack/install.sh` with a companion `version.txt` the shim reads for the latest version.

Local dev:

```
bun install
bun run dev       # ink dev server with hot reload
bun test          # bun:test
bun run lint      # eslint + prettier
bun run build     # produces dist/arrstack-linux-x64 for smoke test
```

## 23. Supported distros

| Tier | Distros | Level |
|---|---|---|
| 1 | Ubuntu 24.04, Debian 13, Fedora 43+ | CI-tested per release, release blocker |
| 2 | Ubuntu 22.04, Debian 12, RHEL/Rocky/Alma 9 | Manual smoke test per release |
| 3 | Arch Linux, openSUSE Tumbleweed | Warned at install, best-effort |
| Unsupported | Alpine, CentOS 7/8, WSL without systemd | Hard-fail at shim with remediation message |

## 24. Open questions for your review

1. **Caddy image source.** Build our own `ghcr.io/lavx/arrstack-caddy:v1` with both CF and DuckDNS plugins, or use `lscr.io/linuxserver/caddy` which supports plugins via env var. Current plan: build our own (more control).
2. **Default storage root.** `/data` (TRaSH canonical) with no prompt, or always prompt. Current: `/data` default with wizard override.
3. **Extra scan-only paths** format in wizard: comma-separated single field vs. multi-line list. Current: comma-separated.
4. **Recyclarr default profiles.** Sonarr: `WEB-1080p`, `WEB-2160p`; Radarr: `HD Bluray + WEB`, `UHD Bluray + WEB`. Acceptable starting point for a typical home library, or expose a wizard choice?
5. **Multi-GPU auto-select.** Pre-select first detected discrete GPU, or always show radio with no default. Current: pre-select first detected with user override.

## Appendix A: References

- Existing installer pattern: `/home/lavx/bazarr/site/install.sh`
- Current production compose: `/opt/quick-arr-Stack/docker-compose.yml` on aurora4 (192.168.100.6)
- TRaSH-Guides folder structure: https://trash-guides.info/File-and-Folder-Structure/How-to-set-up/Docker/
- TRaSH qBittorrent setup: https://trash-guides.info/Downloaders/qBittorrent/Basic-Setup/
- Recyclarr: https://recyclarr.dev
- Ink: https://github.com/vadimdemedes/ink
- Bun compile: https://bun.sh/docs/bundler/executables
- Prowlarr API: https://prowlarr.com/docs
- Servarr env vars: https://wiki.servarr.com/sonarr/environment-variables
- Jellyfin API: `POST /Library/VirtualFolders` (documented in the OpenAPI under `/jellyfin-openapi-stable.yaml`)
