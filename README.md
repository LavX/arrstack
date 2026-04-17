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
  <a href="https://github.com/lavx/arrstack-installer/actions"><img alt="build" src="https://img.shields.io/badge/build-passing-brightgreen" /></a>
  <a href="#license"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue" /></a>
  <a href="#requirements"><img alt="platform" src="https://img.shields.io/badge/linux-x64%20%7C%20arm64-informational" /></a>
  <a href="https://bun.sh"><img alt="bun" src="https://img.shields.io/badge/runtime-bun-f472b6" /></a>
  <a href="https://lavx.github.io/arrstack/"><img alt="homepage" src="https://img.shields.io/badge/docs-lavx.github.io%2Farrstack-000" /></a>
</p>

## What this is

arrstack is a single-binary TUI installer that sets up and cross-wires 12 self-hosted media services on a clean Linux host in about 90 seconds. It writes a TRaSH-compliant compose file, runs `docker compose up -d`, and then calls every service's API so the first boot is already in a working state.

## What problem it solves

Spinning up a self-hosted media stack is a click-fest. You write the compose file. Then you open 10 admin panels, click through auth prompts, paste API keys between tabs, add root folders in Sonarr, paste the same paths into Radarr, add Prowlarr as an indexer source, create download categories in qBittorrent, sync them back to Sonarr, add Bazarr as a Sonarr connection, point Jellyseerr at Jellyfin, accept the TLS cert, wait, retry, realize you forgot FlareSolverr, start again.

TRaSH-Guides has an excellent writeup of what "correct" looks like. Following it by hand takes most of a Saturday, and any mistake shows up two weeks later when a release fails to hardlink and your seed ratio falls off a cliff.

arrstack runs that Saturday for you. It ships as a single ~2 MB Linux binary, asks you a handful of questions in a TUI wizard, writes a TRaSH-compliant compose file, and calls every service's API at boot time to finish the wiring. Re-run the wizard later to add a drive or widen your language profile, it extends what is there instead of starting over.

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
- Single static Linux binary (~2 MB), no runtime dependency beyond Docker
- Interactive TUI built on Ink (React for terminals), arrow-key nav, live validation
- Idempotent wizard: re-running extends libraries and root folders, never clobbers
- `Ctrl+R` in the admin field regenerates the password in place
- Non-interactive mode for config-as-code fans: `--non-interactive` plus env vars

### Auto-wiring (the part that usually takes hours)
- Prowlarr gets 8 public indexers pushed, plus a FlareSolverr proxy tag applied at indexer create-time
- Sonarr and Radarr registered as Prowlarr apps with round-tripped API keys
- qBittorrent gets TRaSH download categories (`tv`, `movies`, `music`, `books`) and is wired as the download client in both Arrs
- Bazarr linked to Sonarr and Radarr with language profiles pre-built using `audio_exclude` + `audio_only_include` + `hi` + seeded `forced` (avoids the vanilla-Bazarr KeyError that bites most first-time users)
- Jellyseerr bootstrapped in four steps (auth, library sync, library enable, initialize) so the `/setup` page never appears
- Trailarr reads its Sonarr and Radarr API keys from `/config/.env` at startup, no manual key paste
- Recyclarr pre-populated with TRaSH profiles for Sonarr v4 and Radarr v5

### Runtime polish
- Jellyfin hardware transcoding auto-detected for Intel (VAAPI), AMD (VAAPI), NVIDIA (NVENC)
- Caddy reverse proxy with three TLS modes: LAN, DuckDNS, Cloudflare DNS-01 wildcard
- Two LAN hostname modes: install dnsmasq for LAN-wide resolution, or print a single `/etc/hosts` line
- TRaSH-compliant shared `/data` mount so hardlinks work across `torrents/` and `media/`
- Optional gluetun + WireGuard VPN container in front of qBittorrent
- Per-service log rotation capped at 50 MB

## Quickstart

```bash
# 1. Install (downloads the binary to /usr/local/bin and runs the wizard)
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
| Arr | Sonarr | TV show manager, linked to Prowlarr + qBittorrent + Bazarr |
| Arr | Radarr | Movie manager, linked to Prowlarr + qBittorrent + Bazarr |
| Media | Jellyfin | Media server, hardware transcoding auto-detected |
| Request | Jellyseerr | Request UI, Jellyfin auth pre-imported, `/setup` skipped |
| Reverse proxy | Caddy | TLS terminator, LAN or DuckDNS or Cloudflare DNS-01 wildcard |
| Quality | Recyclarr | Syncs TRaSH quality profiles into Sonarr and Radarr |
| Subtitles | Bazarr+ | [LavX fork](https://github.com/lavx/bazarr) with OpenSubtitles scraper and OpenRouter translator |
| Trailers | Trailarr | Trailer fetcher, reads Sonarr and Radarr keys from `/config/.env` |
| Optional | gluetun | WireGuard VPN namespace for qBittorrent |
| Optional | dnsmasq | LAN-wide DNS for `*.home.arpa` hostnames |

## How auto-wiring works

Once `docker compose up -d` returns, the installer opens a second loop that talks to each service's REST API. Steady state is reached in roughly 90 seconds on a warm disk.

1. Poll each service until `/ping` (or equivalent) returns 200
2. Read each service's API key from its generated config file
3. Push Prowlarr's 8 indexer definitions, applying the FlareSolverr proxy tag to the ones that need it
4. Register Sonarr and Radarr as Prowlarr "apps", round-tripping their API keys
5. Create qBittorrent download categories per TRaSH and assign them as download clients in Sonarr and Radarr
6. Create root folders in Sonarr and Radarr under `/data/media/tv` and `/data/media/movies`
7. Register Sonarr and Radarr as Bazarr connections, then create language profiles (avoids the `audio_exclude` KeyError)
8. Bootstrap Jellyfin's admin user, then create Movies + TV + Music libraries and scan them
9. Drive Jellyseerr's four-step setup flow via its internal API so the wizard page never renders
10. Trigger Recyclarr once to apply TRaSH quality profiles

Every step is idempotent. Running `arrstack install --resume` after a partial failure picks up at the first incomplete step.

## Remote access

Pick one during the wizard. You can switch later by re-running. Details in [docs/guide/04-remote-access.md](docs/guide/04-remote-access.md).

| Mode | Prerequisites | What you get | TLS | Cost |
| --- | --- | --- | --- | --- |
| LAN | None | `http://host-ip:port` | None | Free |
| DuckDNS | Free DuckDNS subdomain + token | `https://you.duckdns.org` | Let's Encrypt via HTTP-01 | Free |
| Cloudflare DNS | Owned domain on Cloudflare + API token with `Zone:DNS:Edit` | `https://*.your.tld` | Let's Encrypt wildcard via Cloudflare DNS-01 | Domain registration |

LAN mode is the default and expects nothing. DuckDNS is the right pick if you do not own a domain. Cloudflare DNS mode uses your API token so Caddy can solve the ACME DNS-01 challenge and issue one wildcard cert that covers `jellyfin.your.tld`, `sonarr.your.tld`, and every other subdomain. No cloudflared daemon, no tunnel. Just DNS records managed via API for cert issuance and renewal.

## LAN hostnames

Friendly URLs on your LAN so you do not have to memorize `:8096`, `:7878`, `:8989`.

| Mode | What the installer does | What you do | Works on |
| --- | --- | --- | --- |
| None | Nothing | Use `host-ip:port` | Any device |
| dnsmasq | Runs a dnsmasq container bound to LAN, advertises `*.home.arpa` | Point your router's DHCP DNS at the host | Every device on the LAN, phones included |
| hosts file | Writes a block to `FIRST-RUN.md` | Paste it into `/etc/hosts` on each client | Per-device only |

`dnsmasq` is the right pick if you own the router. `hosts file` is the right pick for a single laptop.

## Hardware transcoding

Detected at install time by inspecting `/dev/dri`, `lspci`, and `nvidia-smi`. The detected vendor is written into the compose file so the right device node is passed through.

| Vendor | Detection | Runtime flag in compose | Notes |
| --- | --- | --- | --- |
| Intel Quick Sync | `/dev/dri/renderD128` + iHD driver | `devices: /dev/dri:/dev/dri` | Fastest path, AV1 decode on Arc and 11th gen+ |
| AMD | `/dev/dri/renderD128` + amdgpu | `devices: /dev/dri:/dev/dri` | VAAPI, works out of the box on Ryzen APUs |
| NVIDIA | `nvidia-smi` returns 0 + NVIDIA Container Toolkit present | `runtime: nvidia`, `NVIDIA_VISIBLE_DEVICES=all` | Needs the NVIDIA Container Toolkit installed on the host |
| None | Nothing detected | No device passthrough | Software transcode only, fine for direct play |

If auto-detection picks the wrong vendor, override with `--gpu intel|amd|nvidia|none` during install. More in [docs/troubleshooting/gpu-transcoding-debug.md](docs/troubleshooting/gpu-transcoding-debug.md).



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
└── extra-1            # extra drive added via the wizard
    ├── tv
    └── movies
```

Every container that touches media mounts `/data` at `/data`. That means Sonarr, Radarr, qBittorrent, Jellyfin, and Bazarr all see the same paths, which is the whole reason hardlinks work.

Add a drive later by mounting it on the host, re-running `arrstack`, and entering the mount path under "Extra scan paths". The installer re-renders the compose file, creates `tv/` and `movies/` on the new drive, and pushes matching root folders to Sonarr, Radarr, and Jellyfin. See [docs/guide/05-extra-drives.md](docs/guide/05-extra-drives.md).

## Day-two commands

| Command | What it does |
| --- | --- |
| `arrstack install` | Runs the wizard and installs (default when no subcommand is given) |
| `arrstack doctor` | Runs 40+ health checks (containers up, API reachable, hardlinks working) |
| `arrstack update` | Pulls latest images, recreates containers with no config loss |
| `arrstack show-password` | Prints the generated admin password to stdout |
| `arrstack logs <svc>` | Tails a single service (`jellyfin`, `sonarr`, etc) |
| `arrstack uninstall` | Stops the stack, preserves media; `--purge` wipes configs too |

Global flags: `--verbose`, `--non-interactive`.
`install` flags: `--fresh`, `--resume`, `--install-dir <path>`.

## Configuration reference

| Location | What lives there | Permissions |
| --- | --- | --- |
| `<install-dir>/docker-compose.yml` | Rendered from the wizard, safe to diff and commit | `644`, owned by installing user |
| `<install-dir>/.env` | Admin creds, API keys, PUID/PGID, timezone | `600`, owned by installing user |
| `<install-dir>/config/<svc>/` | Per-service state (databases, metadata cache) | `755`, owned by `PUID:PGID` |
| `<install-dir>/FIRST-RUN.md` | Generated cheat sheet with URLs, passwords, hosts line | `644` |
| `/data/` | Media and torrents, configurable during install | `775`, owned by `PUID:PGID` |

Default `PUID` and `PGID` are the installing user's `id -u` and `id -g`. Override in the wizard if you want a dedicated `media` user.

## Development

```bash
# Clone and set up
git clone https://github.com/lavx/arrstack-installer
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

## Roadmap

- `arrstack backup` and `arrstack restore`: tarball of configs + compose, portable across hosts
- NixOS module so the stack can be declared instead of imperatively installed
- Readarr and Lidarr as optional services in the wizard
- Web UI mirror of the TUI wizard for users who prefer a browser
- Built-in Immich bridge for photo libraries alongside video

## Credits

Built on the shoulders of the projects that do the actual work:

- [Sonarr](https://sonarr.tv), [Radarr](https://radarr.video), [Prowlarr](https://prowlarr.com), [Bazarr](https://www.bazarr.media)
- [Jellyfin](https://jellyfin.org), [Jellyseerr](https://github.com/Fallenbagel/jellyseerr)
- [qBittorrent](https://www.qbittorrent.org), [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr)
- [Caddy](https://caddyserver.com), [Recyclarr](https://recyclarr.dev), [Trailarr](https://github.com/nandyalu/trailarr)
- [gluetun](https://github.com/qdm12/gluetun), [dnsmasq](https://thekelleys.org.uk/dnsmasq/doc.html)
- [TRaSH-Guides](https://trash-guides.info), whose recommendations this installer encodes
- [Bun](https://bun.sh) and [Ink](https://github.com/vadimdemedes/ink) for making a 2 MB TUI binary possible

## Brand and project site

arrstack is a LavX project. The project site is [lavx.github.io/arrstack](https://lavx.github.io/arrstack/).

## License

[MIT](./LICENSE) (c) 2026 [LavX](https://lavx.github.io)
