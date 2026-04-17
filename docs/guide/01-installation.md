# 01. Installation

12 services. One binary. 90 seconds. This page covers installing arrstack from a fresh Linux box to a working TUI wizard. You will confirm prerequisites, run the one-line installer, and walk every screen of the wizard with sensible defaults. Plan for 5 to 15 minutes of wall-clock time, most of which is Docker image pulls.

## TL;DR

```bash
# One-line install
curl -fsSL https://lavx.github.io/arrstack/install.sh | bash

# Run the wizard
arrstack install

# Resume a partially finished run
arrstack install --resume
```

## Supported systems

| Distro    | Minimum version | Tested |
|-----------|-----------------|--------|
| Ubuntu    | 22.04 LTS       | yes    |
| Debian    | 12 (bookworm)   | yes    |
| Fedora    | 43              | yes    |

Other distros may work if they ship Docker 24+ and systemd. arrstack is Linux only. No macOS, no WSL, no Windows.

## Pre-flight check

Run these before you start. The installer will run its own `arrstack doctor`, but fixing issues up front is faster.

```bash
# Docker running
docker ps

# Compose v2 available
docker compose version

# Disk space (need 10 GB free for images, plus media storage)
df -h ~

# Your own UID/GID (write these down, the wizard asks)
id -u
id -g

# Current timezone
timedatectl show --property=Timezone --value
```

If Docker is missing, install it from https://docs.docker.com/engine/install/ and add your user to the `docker` group: `sudo usermod -aG docker $USER`, then log out and back in.

## The install command

```bash
curl -fsSL https://lavx.github.io/arrstack/install.sh | bash
```

What the script does:

1. Detects your architecture (x86_64 and aarch64 are supported; Alpine is refused).
2. Downloads the matching `arrstack` binary (about 100 MB, bundles the Bun runtime) and a `checksums.txt` from the latest GitHub Release. Verifies the SHA256.
3. If `~/.local/bin` exists AND is already on your PATH, installs there. Otherwise installs to `/usr/local/bin` (via sudo).
4. Execs `arrstack install` directly, which drops you into the TUI wizard.

If you prefer not to pipe curl to bash, the script URL is plain text. Read it, then save and execute it by hand.

## CLI overview

```
arrstack install          Run the TUI wizard
arrstack install --fresh  Wipe state and start over
arrstack install --resume Continue from last saved step
arrstack doctor           Health check existing install
arrstack update           Pull latest images and restart
arrstack show-password    Print admin credentials
arrstack logs [service]   Tail logs (all services or one)
arrstack uninstall        Remove containers and optionally data
```

Global flags: `--verbose` (debug output), `--non-interactive` (fail rather than prompt).

## Wizard walkthrough

Each screen has a sensible default. Arrow keys navigate, Enter confirms, Esc goes back, Ctrl+C aborts safely.

### 1. Install directory

| Field         | Default         | Notes |
|---------------|-----------------|-------|
| Install dir   | `~/arrstack`    | Holds configs, state, compose files. Keep on fast local disk. |

### 2. Storage root

| Field         | Default              | Notes |
|---------------|----------------------|-------|
| Storage root  | `~/arrstack/data`    | Media and downloads live here. Point at your big disk. |
| Extra scan paths | (empty)           | Add mount points for secondary drives. See `05-extra-drives.md`. |

Layout created under the storage root (TRaSH Guides compliant):

```
data/
  torrents/
    tv/ movies/ music/ books/
  media/
    tv/ movies/ music/
```

### 3. Admin credentials

| Field      | Default                          | Notes |
|------------|----------------------------------|-------|
| Username   | `admin`                          | Shared across all arr services. |
| Password   | 20-char generated                | Press Ctrl+R to regenerate. Hint shows only when the password field is focused. |

The password is written to `~/arrstack/admin.txt` (mode 0o600) and printable later with `arrstack show-password`.

### 4. Services

Toggle each service. Defaults in bold.

| Service       | Default | Purpose |
|---------------|---------|---------|
| qBittorrent   | **on**  | Torrent client |
| Prowlarr      | **on**  | Indexer aggregator |
| FlareSolverr  | **on**  | Cloudflare challenge solver |
| Sonarr        | **on**  | TV automation |
| Radarr        | **on**  | Movie automation |
| Bazarr+       | **on**  | Subtitles, LavX fork with AI translator |
| Jellyfin      | **on**  | Media server |
| Jellyseerr    | **on**  | Request frontend |
| Caddy         | **on**  | Reverse proxy |
| Trailarr      | **on**  | Trailer fetcher |
| Recyclarr     | **on**  | TRaSH quality profiles |

### 5. GPU

Auto-detected. Override if you want to force one.

| Option        | When to pick it |
|---------------|-----------------|
| None          | CPU transcode only |
| Intel QSV     | Intel iGPU (UHD 6xx+) |
| NVIDIA NVENC  | GeForce 1050+ with `nvidia-container-toolkit` installed |
| VAAPI         | AMD GPU or generic DRM |

### 6. Remote access

| Mode              | What it does |
|-------------------|--------------|
| LAN               | Bind Caddy to your LAN IP, no public exposure |
| DuckDNS           | Free dynamic DNS, Let's Encrypt via HTTP-01 |
| Cloudflare        | Your domain on Cloudflare DNS, wildcard Let's Encrypt via DNS-01 |

Details in `04-remote-access.md`.

### 7. Local DNS

Two independent flags:

| Flag                     | Effect |
|--------------------------|--------|
| Use LAN hostnames        | Generate Caddy vhosts for `sonarr.arr.lan` etc. |
| Install dnsmasq          | Resolve those hostnames on the LAN without edits to client `/etc/hosts` |

### 8. VPN

| Field             | Default | Notes |
|-------------------|---------|-------|
| Enable gluetun    | off     | Only qBittorrent routes through by default. |
| Provider          | mullvad | Also: protonvpn, airvpn, custom wireguard |
| Wireguard config  | paste   | Private key, address, endpoint. See `06-vpn.md`. |

### 9. System

| Field              | Default               | Notes |
|--------------------|-----------------------|-------|
| Timezone           | detected from host    | IANA format, `Europe/Berlin` etc. |
| PUID               | current user UID      | File ownership inside containers |
| PGID               | current user GID      | File ownership inside containers |
| Subtitle languages | `eng`                 | Comma list, ISO 639-2. Example: `eng,ger,fre` |

## What happens after the last screen

The wizard writes state to `~/arrstack/state.json` (mode 0o600), generates the compose file, pulls images, starts containers, and runs the auto-wiring sequence. See `02-first-run.md` for what each service looks like when it comes up.

If something fails mid-install, rerun with `arrstack install --resume`. To start completely over, `arrstack install --fresh` deletes state but preserves media under `data/`.

## Next steps

- [02. First run](02-first-run.md): check URLs, confirm auto-wiring succeeded, run the 10-minute smoke test.
- [04. Remote access](04-remote-access.md): pick LAN, DuckDNS, or Cloudflare and make it reachable.
- [06. VPN (gluetun + WireGuard)](06-vpn.md): route qBittorrent through a WireGuard tunnel.
