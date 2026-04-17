# arrstack

One-command install for your Sonarr, Radarr, Jellyfin, and friends.

## Install

    curl -fsSL https://lavx.github.io/arrstack/install.sh | bash

## What it installs

10 services, pre-configured and cross-wired:

- **qBittorrent**: torrent download client
- **Prowlarr**: indexer manager (5 public indexers pre-added)
- **FlareSolverr**: solves Cloudflare challenges for indexers
- **Sonarr**: TV show manager
- **Radarr**: movie manager
- **Bazarr**: subtitle manager
- **Jellyfin**: media server (hardware transcoding auto-detected)
- **Jellyseerr**: request manager (linked to Jellyfin)
- **Caddy**: reverse proxy with automatic HTTPS
- **Recyclarr**: syncs TRaSH quality profiles

Optional: tdarr (transcoding), trailarr (trailers), gluetun (VPN).

## What gets configured automatically

- Single admin account across every service
- Prowlarr indexers and app connections to Sonarr/Radarr
- qBittorrent download categories (tv, movies, music, books) per TRaSH
- Sonarr/Radarr root folders and download client
- Bazarr linked to Sonarr and Radarr
- Jellyfin admin user, libraries (Movies, TV, Music)
- Jellyseerr linked to Jellyfin
- TRaSH quality profiles via Recyclarr
- Intel/AMD/NVIDIA hardware transcoding (auto-detected)
- Remote access via DuckDNS (free) or Cloudflare (your domain)
- Per-service log rotation (50 MB cap)

## Requirements

- Linux (Ubuntu 22.04+, Debian 12+, Fedora 43+)
- Docker + Docker Compose v2
- 10 GB free disk for images, plus storage for media

## After install

1. Sign in to Jellyseerr (one click, already linked to Jellyfin)
2. Request a movie or show

That is it. Everything else was configured during install.

## Day-two commands

```
arrstack              re-open the config form (add/remove services)
arrstack doctor       run diagnostics
arrstack update       pull latest images
arrstack show-password
arrstack logs <svc>   tail a service
arrstack uninstall    stop the stack (media preserved)
```

## Remote access

The installer supports three modes:
- **LAN only** (default): access via http://host-ip:port
- **DuckDNS** (free): get a subdomain like myhome.duckdns.org with real HTTPS
- **Cloudflare**: use your own domain with wildcard Let's Encrypt certs

## Storage layout

Follows TRaSH-Guides recommendations for hardlinks:

```
/data/
├── torrents/{tv,movies,music,books}
└── media/{tv,movies,music}
```

Additional drives can be added as scan-only paths during install.

## Development

```
bun install
bun run dev          # run the CLI locally
bun test             # run tests
bun run build        # compile to dist/arrstack-linux-x64
```

## License

MIT
