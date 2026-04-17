<p align="center">
  <img src="docs/assets/logomark.svg" alt="arrstack" width="160" />
</p>

<h1 align="center">arrstack-installer</h1>

<p align="center"><strong>12 services. One binary. 90 seconds.</strong></p>

<p align="center"><em>The arr stack, pre-wired. Jellyseerr on :5055, zero setup screen.</em></p>

```bash
curl -fsSL https://lavx.github.io/arrstack/install.sh | bash
```

<!-- badges: swap the placeholder URLs once CI is green and releases are tagged -->
<p align="center">
  <a href="https://github.com/lavx/arrstack/actions"><img alt="build" src="https://img.shields.io/badge/build-passing-brightgreen" /></a>
  <a href="#license"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue" /></a>
  <a href="#requirements"><img alt="platform" src="https://img.shields.io/badge/linux-x64%20%7C%20arm64-informational" /></a>
  <a href="https://bun.sh"><img alt="bun" src="https://img.shields.io/badge/runtime-bun-f472b6" /></a>
  <a href="https://lavx.github.io/arrstack/"><img alt="homepage" src="https://img.shields.io/badge/docs-lavx.github.io%2Farrstack-000" /></a>
</p>

## What this is

arrstack is a single-binary TUI installer that sets up and cross-wires 12 self-hosted media services on a clean Linux host in about 90 seconds. It writes a TRaSH-compliant compose file, runs `docker compose up -d`, and then calls every service's API so the first boot is already in a working state.

## What problem it solves

Spinning up a self-hosted media stack is a click-fest. You write the compose file. Then you open 10 admin panels, click through auth prompts, paste API keys between tabs, add root folders in Sonarr, paste the same paths into Radarr, add Prowlarr as an indexer source, create download categories in qBittorrent, sync them back to Sonarr, add Bazarr+ as a Sonarr connection, point Jellyseerr at Jellyfin, accept the TLS cert, wait, retry, realize you forgot FlareSolverr, start again.

TRaSH-Guides has an excellent writeup of what "correct" looks like. Following it by hand takes most of a Saturday, and any mistake shows up two weeks later when a release fails to hardlink and your seed ratio falls off a cliff.

arrstack runs that Saturday for you. It ships as a single self-contained Linux binary (~100 MB, Bun runtime bundled), asks you a handful of questions in a TUI wizard, writes a TRaSH-compliant compose file, and calls every service's API at boot time to finish the wiring. Re-run the wizard later to add a drive or widen your language profile, it extends what is there instead of starting over.

## Documentation

The README is a tour. The full user guide lives under `docs/`.

- [User guide: Installation](docs/guide/01-installation.md)
- [User guide: First run](docs/guide/02-first-run.md)
- [User guide: Remote access (LAN, DuckDNS, Cloudflare DNS)](docs/guide/04-remote-access.md)
- [User guide: Extra drives](docs/guide/05-extra-drives.md)
- [User guide: VPN (gluetun + WireGuard)](docs/guide/06-vpn.md)
- [User guide: Backup and restore](docs/guide/08-backup-restore.md)
- [Troubleshooting: common errors](docs/troubleshooting/common-errors.md)
- [Troubleshooting: diagnostic commands](docs/troubleshooting/diagnostic-commands.md)

## Features

### Install experience
- Single self-contained Linux binary (~100 MB, bundles the Bun runtime), no runtime dependency beyond Docker
- Interactive TUI built on Ink (React for terminals), arrow-key nav, live validation
- Idempotent wizard: re-running extends libraries and root folders, never clobbers
- `Ctrl+R` in the admin field regenerates the password in place
- `--non-interactive` flag for unattended / CI runs (uses the same defaults the wizard would)

### Auto-wiring (the part that usually takes hours)
- Prowlarr gets 8 public indexers pushed, plus a FlareSolverr proxy tag applied at indexer create-time
- Sonarr and Radarr registered as Prowlarr apps with `syncLevel: fullSync` and round-tripped API keys, so new indexers auto-push on creation
- qBittorrent gets TRaSH download categories (`tv`, `movies`, `music`, `books`) and is wired as the download client in both arrs
- Bazarr+ linked to Sonarr and Radarr via a pre-written `config.yaml`, with a default language profile whose items carry `audio_exclude`, `audio_only_include`, `hi`, and `forced` (all four required to avoid the `KeyError` that bites most first-time installs)
- Jellyseerr bootstrapped in four steps (auth, library sync, library enable, initialize) so the `/setup` page never appears
- Trailarr reads its own generated API key from `${installDir}/config/trailarr/.env`, replaces the default `admin/trailarr` login, and seeds Sonarr and Radarr connections with `monitor: "new"`
- Recyclarr runs a single `sync` on install with inline quality profiles in the v8 config format (Sonarr `WEB-1080p`, Radarr `HD Bluray + WEB`)

### Runtime polish
- Jellyfin hardware transcoding auto-detected for Intel (VAAPI), AMD (VAAPI), NVIDIA (NVENC)
- Caddy reverse proxy with three remote-access modes: LAN (plain HTTP), DuckDNS (Let's Encrypt), Cloudflare DNS-01 wildcard Let's Encrypt
- Two LAN hostname modes: install dnsmasq for LAN-wide resolution, or print a single `/etc/hosts` line
- TRaSH-compliant shared `/data` mount so hardlinks work across `torrents/` and `media/`
- Optional gluetun + WireGuard VPN container in front of qBittorrent
- Per-service log rotation capped at 50 MB

## Quickstart

```bash
# 1. Install (downloads the binary to ~/.local/bin if it is on PATH, else /usr/local/bin via sudo, then runs the wizard)
curl -fsSL https://lavx.github.io/arrstack/install.sh | bash

# 2. Check everything came up
arrstack doctor

# 3. Grab the generated admin password (same for every service)
arrstack show-password

# 4. Open Jellyseerr, it is already signed into Jellyfin
xdg-open http://$(hostname -I | awk '{print $1}'):5055

# 5. Later: pull new images and restart
arrstack update
```

## Services

Twelve services, grouped by role. Each runs in its own container under the shared `/data` tree.

| Group | Service | One-liner |
| --- | --- | --- |
| Download | qBittorrent | Torrent client, TRaSH categories pre-created |
| Indexer | Prowlarr | Indexer manager, 8 public indexers pre-added |
| Indexer | FlareSolverr | Cloudflare challenge solver, wired as a Prowlarr proxy tag |
| Arr | Sonarr | TV show manager, linked to Prowlarr + qBittorrent + Bazarr+ |
| Arr | Radarr | Movie manager, linked to Prowlarr + qBittorrent + Bazarr+ |
| Media | Jellyfin | Media server, hardware transcoding auto-detected |
| Request | Jellyseerr | Request UI, Jellyfin auth pre-imported, `/setup` skipped |
| Reverse proxy | Caddy | TLS terminator, LAN or DuckDNS or Cloudflare DNS-01 wildcard |
| Quality | Recyclarr | Syncs TRaSH quality profiles into Sonarr and Radarr |
| Subtitles | Bazarr+ | [LavX fork](https://lavx.github.io/bazarr/) with OpenSubtitles scraper and OpenRouter translator |
| Trailers | Trailarr | Trailer fetcher, API key read from `/config/.env`, Sonarr and Radarr connections seeded by the installer |
| Optional | gluetun | WireGuard VPN namespace for qBittorrent |
| Optional | dnsmasq | LAN-wide DNS for `*.<your TLD>` hostnames (wizard default `arrstack.local`) |

## How auto-wiring works

Once `docker compose up -d` returns, the installer opens a second loop that talks to each service's REST API. Steady state is reached in roughly 90 seconds on a warm disk.

1. Poll every service with an HTTP healthcheck until it returns 200 (Bazarr+ uses `/api/system/ping`, Jellyfin `/Startup/User`, etc.)
2. Drive Jellyfin's startup: `POST /Startup/Configuration`, `POST /Startup/User`, then `POST /Users/{id}/Policy` with `IsAdministrator: true` to fix the occasional 10.11 admin-flag gap, then create Movies at `/data/media/movies`, TV at `/data/media/tv`, Music at `/data/media/music`
3. Bootstrap Jellyseerr in four `POST`s: `/api/v1/auth/jellyfin` (with `serverType: 2` and `hostname: "jellyfin"`), `/api/v1/settings/jellyfin/library?sync=true`, `/api/v1/settings/jellyfin/library?enable=...`, `/api/v1/settings/initialize`. A later re-auth drops `hostname` because Jellyseerr returns HTTP 500 when it is already configured
4. Configure Bazarr+ languages and the default profile via `POST /api/system/settings`, using the same API key the pre-written `config.yaml` seeded
5. Create qBittorrent TRaSH categories and push TRaSH-recommended preferences over the WebUI API
6. Seed admin credentials on Sonarr, Radarr, and Prowlarr with `PUT /api/v{N}/config/host`, setting `authenticationMethod: "forms"`, `authenticationRequired: "enabled"`, `username`, `password`, and `passwordConfirmation` (accepts HTTP 200 or 202)
7. Wire Prowlarr in strict order: register Sonarr and Radarr as apps (`syncLevel: fullSync`), create the `flaresolverr` tag and indexer-proxy, create the 8 public indexers with the tag stamped in the POST body, then re-PUT every indexer to re-push the app sync
8. Configure Sonarr and Radarr root folders under `/data/media/tv` and `/data/media/movies`, then add qBittorrent as a download client with the matching TRaSH category (`tv`/`movies`)
9. Link Jellyseerr to Sonarr and Radarr via `/api/v1/settings/{sonarr,radarr}` with `activeProfileId: 1` and `activeDirectory` pointing at the root folders
10. Read Trailarr's auto-generated `API_KEY` from `${installDir}/config/trailarr/.env`, swap the `admin/trailarr` default login via `PUT /api/v1/settings/updatelogin`, then add Sonarr and Radarr connections with `monitor: "new"`
11. Run `recyclarr sync` once to apply the inline v8 quality profiles to Sonarr and Radarr

Every step is idempotent. Running `arrstack install --resume` after a partial failure picks up at the first incomplete step.

## Remote access

Pick one during the wizard. You can switch later by re-running. Details in [docs/guide/04-remote-access.md](docs/guide/04-remote-access.md).

| Mode | Prerequisites | What you get | TLS | Cost |
| --- | --- | --- | --- | --- |
| LAN | None | `http://host-ip:port` | None | Free |
| DuckDNS | Free DuckDNS subdomain + token, plus a Caddy image with the DuckDNS DNS plugin | `https://you.duckdns.org` | Let's Encrypt via DNS-01 (DuckDNS plugin) | Free |
| Cloudflare DNS | Owned domain on Cloudflare + API token with `Zone:DNS:Edit` and `Zone:Zone:Read`, plus a Caddy image with the Cloudflare DNS plugin | `https://*.your.tld` | Let's Encrypt wildcard via Cloudflare DNS-01 | Domain registration |

LAN mode is the default and expects nothing. DuckDNS is the right pick if you do not own a domain. Cloudflare DNS mode uses your API token so Caddy can solve the ACME DNS-01 challenge and issue one wildcard cert that covers `jellyfin.your.tld`, `sonarr.your.tld`, and every other subdomain. No cloudflared daemon, no tunnel. Just DNS records managed via API for cert issuance and renewal.

Heads-up about Caddy plugins: the stock `caddy:latest` image in the compose file does not include the Cloudflare or DuckDNS DNS plugins. For either remote mode to obtain certificates, the image must be swapped for a build that includes the matching plugin, for example via `xcaddy build --with github.com/caddy-dns/cloudflare --with github.com/caddy-dns/duckdns`. LAN mode is unaffected and works on the stock image.

## LAN hostnames

Friendly URLs on your LAN so you do not have to memorize `:8096`, `:7878`, `:8989`.

| Mode | What the installer does | What you do | Works on |
| --- | --- | --- | --- |
| None | Nothing | Use `host-ip:port` | Any device |
| dnsmasq | Runs a dnsmasq container bound to LAN, advertises `*.<your TLD>` (wizard default `arrstack.local`) | Point your router's DHCP DNS at the host | Every device on the LAN, phones included |
| hosts file | Writes a block to `FIRST-RUN.md` | Paste it into `/etc/hosts` on each client | Per-device only |

`dnsmasq` is the right pick if you own the router. `hosts file` is the right pick for a single laptop.

## Hardware transcoding

Detected at install time by parsing `lspci -nn` for display-class devices, checking for `/dev/dri/renderD128`, and probing `nvidia-ctk --version`. The detected vendor is written into the compose file so the right device node and group memberships are passed through.

| Vendor | Detection | Runtime wiring | Notes |
| --- | --- | --- | --- |
| Intel (VAAPI / QSV) | PCI vendor `8086` in `lspci -nn` + `/dev/dri/renderD128` present | `devices: /dev/dri/renderD128` + `group_add:` render/video GIDs | Fastest path, AV1 decode on Arc and 11th gen+ |
| AMD (VAAPI) | PCI vendor `1002` in `lspci -nn` + `/dev/dri/renderD128` present | `devices: /dev/dri/renderD128` + `group_add:` render/video GIDs | VAAPI, works out of the box on Ryzen APUs |
| NVIDIA (NVENC) | PCI vendor `10de` in `lspci -nn` + `nvidia-ctk --version` succeeds | NVIDIA Container Toolkit runtime handles device pass-through | Requires `nvidia-container-toolkit` on the host |
| None | Nothing detected | No device passthrough | Software transcode only, fine for direct play |

If auto-detection picks the wrong vendor, pick the correct one in the wizard's GPU screen. For an existing install, edit `~/arrstack/state.json` to set `gpu.vendor` and re-run `arrstack install --resume`. More in [docs/troubleshooting/gpu-transcoding-debug.md](docs/troubleshooting/gpu-transcoding-debug.md).



## Storage layout

TRaSH-compliant, hardlink-safe. Everything downloaded, imported, and watched lives under a single `/data` tree so hardlinks across `torrents/` and `media/` work without double-using disk.

```
/data
├── torrents
│   ├── tv
│   ├── movies
│   ├── music
│   └── books
├── media
│   ├── tv
│   ├── movies
│   └── music
└── extra-0            # first extra drive added via the wizard (extra-1, extra-2, ...)
    ├── tv
    └── movies
```

Every container that touches media mounts `/data` at `/data`. That means Sonarr, Radarr, qBittorrent, Jellyfin, and Bazarr+ all see the same paths, which is the whole reason hardlinks work.

Add a drive later by mounting it on the host, re-running `arrstack`, and entering the mount path under "Extra scan paths". The installer re-renders the compose file, creates `tv/` and `movies/` on the new drive, and pushes matching root folders to Sonarr, Radarr, and Jellyfin. See [docs/guide/05-extra-drives.md](docs/guide/05-extra-drives.md).

## Day-two commands

| Command | What it does |
| --- | --- |
| `arrstack install` | Runs the wizard and installs (default when no subcommand is given) |
| `arrstack doctor` | Three passes: preflight (Docker installed + running, Compose v2 present, 10 GB free on `/` and on `storage_root`, ports 80 and 443 free), `docker compose ps` container state, then an HTTP probe on every service that declares an HTTP healthcheck |
| `arrstack update` | `docker compose pull` then `docker compose up -d`. Configs and media untouched |
| `arrstack show-password` | Prints `<install-dir>/admin.txt` (username, password, timestamp) to stdout |
| `arrstack logs <svc>` | Follows `docker compose logs -f <svc>` for one service (`jellyfin`, `sonarr`, etc) |
| `arrstack uninstall` | `docker compose down` only. Preserves `config/`, `state.json`, `admin.txt`, and media. Add `--purge` to also delete `<install-dir>/config/`; `state.json`, `admin.txt`, and media still survive |

Global flags: `--verbose`, `--non-interactive`.
`install` flags: `--fresh`, `--resume`, `--install-dir <path>`.

## Configuration reference

Default `<install-dir>` is `~/arrstack`. Default `storage_root` (mounted as `/data` inside every container) is `~/arrstack/data`. Both are chosen in the wizard.

| Location | What lives there | Permissions |
| --- | --- | --- |
| `<install-dir>/state.json` | Zod-validated source of truth: schema version, installer version, install and storage paths, extra paths, admin username, enabled services, GPU, remote access, local DNS, VPN, timezone, PUID/PGID, subtitle languages, API keys, install timestamps. No passwords are stored here | `600`, owned by installing user |
| `<install-dir>/docker-compose.yml` | Rendered from `state.json`, safe to diff and commit | `644`, owned by installing user |
| `<install-dir>/.env` | Admin creds, service API keys, PUID/PGID, timezone, the translator encryption key shared between Bazarr+ and the AI translator, plus the DuckDNS or Cloudflare token when those modes are enabled | `600`, owned by installing user |
| `<install-dir>/admin.txt` | Seeded admin username, password, and timestamp. Read by `arrstack show-password` | `600`, owned by installing user |
| `<install-dir>/config/<svc>/` | Per-service state (databases, metadata cache). Pre-created and `chown`ed to `PUID:PGID` before first `compose up` | `755`, owned by `PUID:PGID` |
| `<install-dir>/FIRST-RUN.md` | Cheat sheet with URLs and hosts-file snippet, written at the end of install | `644` |
| `storage_root/` (default `~/arrstack/data/`) | Media and torrents, mounted as `/data` inside every container | `775`, owned by `PUID:PGID` |

Default `PUID` and `PGID` are the installing user's `id -u` and `id -g`. Override in the wizard if you want a dedicated `media` user.

## Development

```bash
# Clone and set up
git clone https://github.com/lavx/arrstack
cd arrstack-installer
bun install

# Run the TUI locally without compiling
bun run dev

# Unit + integration tests (bun test under the hood)
bun test

# Strict type check, no emit
bun run typecheck

# Compile a single static binary (uses `bun build --compile`)
bun run build           # -> dist/arrstack-linux-x64
bun run build:arm64     # -> dist/arrstack-linux-arm64
```

The project is Bun-native: `Bun.serve`, `Bun.file`, `Bun.$`, and `bun:sqlite` for the state DB. No Node runtime is needed at install time, the compiled binary carries its own.

## Credits

Built on the shoulders of the projects that do the actual work:

- [Sonarr](https://sonarr.tv), [Radarr](https://radarr.video), [Prowlarr](https://prowlarr.com), [Bazarr+](https://lavx.github.io/bazarr/)
- [Jellyfin](https://jellyfin.org), [Jellyseerr](https://github.com/Fallenbagel/jellyseerr)
- [qBittorrent](https://www.qbittorrent.org), [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr)
- [Caddy](https://caddyserver.com), [Recyclarr](https://recyclarr.dev), [Trailarr](https://github.com/nandyalu/trailarr)
- [gluetun](https://github.com/qdm12/gluetun), [dnsmasq](https://thekelleys.org.uk/dnsmasq/doc.html)
- [TRaSH-Guides](https://trash-guides.info), whose recommendations this installer encodes
- [Bun](https://bun.sh) and [Ink](https://github.com/vadimdemedes/ink), which carry the TUI and the compiled single-binary distribution

## Brand and project site

arrstack is a LavX project. The project site is [lavx.github.io/arrstack](https://lavx.github.io/arrstack/).

## License

[MIT](./LICENSE) (c) 2026 [LavX](https://lavx.hu)
