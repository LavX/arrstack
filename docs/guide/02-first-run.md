# 02. First run: what just happened, and where

The wizard finished. This page tells you exactly what the installer wrote to disk, what it wired together inside each container, which URLs to open first, and how to smoke-test the stack in under 10 minutes. Follow the URLs in order, the later ones depend on the earlier ones being healthy.

## TL;DR

```bash
# Get your admin password
arrstack show-password

# See every running service
docker compose -f ~/arrstack/docker-compose.yml ps

# Tail everything
arrstack logs

# Full URL list for your install
cat ~/arrstack/FIRST-RUN.md
```

## Filesystem layout

Everything the installer manages sits under two roots.

| Path                                        | Mode  | Contents |
|---------------------------------------------|-------|----------|
| `~/arrstack/`                               | 0o755 | Install root |
| `~/arrstack/state.json`                     | 0o600 | Wizard answers, port map, seeds |
| `~/arrstack/admin.txt`                      | 0o600 | Username and password, plain text |
| `~/arrstack/FIRST-RUN.md`                   | 0o644 | Generated URL list, per-install |
| `~/arrstack/docker-compose.yml`             | 0o644 | Generated compose file |
| `~/arrstack/config/<service>/`              | 0o755 | Per-service persistent config |
| `~/arrstack/data/torrents/{tv,movies,...}/` | 0o755 | In-progress and completed downloads |
| `~/arrstack/data/media/{tv,movies,music}/`  | 0o755 | Libraries Jellyfin scans |

Do not edit `state.json` by hand. Use `arrstack install --resume` to change wizard choices.

## What the installer wired up

On a healthy run the auto-wiring sequence does all of the following without you touching a browser. Expect it to take 60 to 180 seconds after containers go healthy.

1. Writes the Sonarr, Radarr, and Prowlarr `config.xml` with `AuthenticationMethod=Forms` and `AuthenticationRequired=Enabled` before `docker compose up -d`, so the containers start with auth already switched on.
2. Pre-writes Bazarr+ `config.yaml` (mounted at `/config/config/config.yaml` inside the container) with `auth.type: form`, a PBKDF2-SHA256 (600k iterations) password hash, the pre-generated API key, and the Sonarr/Radarr API keys so the subtitle fetchers work on first boot.
3. Waits for Jellyfin `/Startup/User` to return 200, walks the Startup Wizard, creates the admin user, and calls `POST /Users/{id}/Policy` with `IsAdministrator: true` to close the 10.11 admin-flag gap. Then creates libraries: Movies at `/data/media/movies`, TV at `/data/media/tv`, Music at `/data/media/music`.
4. Runs Jellyseerr's 4-step bootstrap: `POST /api/v1/auth/jellyfin` with `serverType: 2` and `hostname: "jellyfin"`, `GET /api/v1/settings/jellyfin/library?sync=true`, `GET /api/v1/settings/jellyfin/library?enable=<ids>`, `POST /api/v1/settings/initialize`.
5. Configures Bazarr+ languages + default profile via `POST /api/system/settings`, with each profile item carrying `audio_exclude`, `audio_only_include`, `hi`, and `forced` flags (all four required, omitting any triggers a `KeyError` on the first scan).
6. Creates qBittorrent categories `tv`, `movies`, `music`, `books` and pushes TRaSH preferences (`save_path: /data/torrents`, `max_ratio_enabled: false`, etc.).
7. Seeds the admin user via `PUT /api/v{N}/config/host` on Sonarr (v3), Radarr (v3), and Prowlarr (v1). Body sets `authenticationMethod: "forms"`, `authenticationRequired: "enabled"`, `username`, `password`, `passwordConfirmation`. Sonarr/Radarr return 202, Prowlarr returns 200, both are accepted.
8. Registers Sonarr and Radarr in Prowlarr as apps (`implementation: "Sonarr"`/`"Radarr"`, `syncLevel: "fullSync"`), creates the `flaresolverr` tag and FlareSolverr indexer-proxy, then pushes 8 public indexers with the tag stamped in the POST body (required for FS routing): 1337x, TorrentGalaxyClone, EZTV, The Pirate Bay, YTS, LimeTorrents, Torrent Downloads, Magnet Cat.
9. Configures Sonarr and Radarr root folders (`/data/media/tv`, `/data/media/movies`) and adds qBittorrent as the download client with the matching TRaSH category.
10. Links Jellyseerr to Sonarr and Radarr via `POST /api/v1/settings/{sonarr,radarr}` with `activeProfileId: 1` and `activeDirectory` set to the root folder. A second login first against `/api/v1/auth/jellyfin` omits `hostname` because Jellyseerr returns HTTP 500 if `hostname` is already configured.
11. Reads the Trailarr API key from `~/arrstack/config/trailarr/.env` (match: `^API_KEY=['"]?...['"]?$`), replaces the default `admin/trailarr` login via `PUT /api/v1/settings/updatelogin`, then adds Sonarr and Radarr connections with `monitor: "new"`.
12. Runs `docker compose run --rm recyclarr sync` once (5-minute timeout) to apply the inline v8 quality profiles (`WEB-1080p` for Sonarr, `HD Bluray + WEB` for Radarr).

If any step fails, `arrstack doctor` will print which one and tell you the fix.

## Service URLs, in the order you should visit them

Default ports assuming LAN mode. If you picked DuckDNS or Cloudflare, replace `localhost` with your hostname and drop the port. Username is whatever you set, password is in `~/arrstack/admin.txt`.

| Order | Service     | URL                          | What to check |
|-------|-------------|------------------------------|---------------|
| 1     | Prowlarr    | http://localhost:9696        | All 8 indexers green under Indexers |
| 2     | Sonarr      | http://localhost:8989        | Settings, General, API key exists. Indexers pulled from Prowlarr. |
| 3     | Radarr      | http://localhost:7878        | Same as Sonarr |
| 4     | qBittorrent | http://localhost:8080        | Login works, Downloads tab empty |
| 5     | Jellyfin    | http://localhost:8096        | 3 libraries visible, scan shows 0 items (expected) |
| 6     | Jellyseerr  | http://localhost:5055        | Jellyfin linked, Sonarr+Radarr linked, no red banners |
| 7     | Bazarr+     | http://localhost:6767        | 6 providers enabled by default (OpenSubtitles.com + OpenSubtitles + Embedded + Podnapisi + Addic7ed + YIFY); only the first two need credentials |
| 8     | Trailarr    | http://localhost:7889        | Sonarr and Radarr show as connected |

Caddy is on 80/443. If you picked LAN hostnames, also try `http://sonarr.arr.lan` and similar.

## 10-minute smoke test

Do these in order. Each step verifies the last step worked.

### 1. Prowlarr search hits an indexer

Open Prowlarr, click Search, type `ubuntu 24.04`, hit Enter. You should see results within 10 seconds. If nothing comes back, see `07-providers-setup.md` for Cloudflare challenge issues.

### 2. Sonarr and Radarr see Prowlarr

In Sonarr: Settings, Indexers. You should see 8 indexers all prefixed with the Prowlarr name. Same under Radarr. If the lists are empty, rerun the sync in Prowlarr: Settings, Apps, click Sonarr, click Test, click Sync App Indexers.

### 3. qBittorrent is running

Open qBittorrent WebUI. Settings, WebUI: ensure the bypass for localhost is on. Settings, Downloads: default save path should be `/data/torrents`.

### 4. Jellyseerr can request a movie

In Jellyseerr, search `Oppenheimer`. Click the result, click Request. Jellyseerr should show the request as pending, and Radarr should show the movie appear under Movies within 5 seconds.

Do not expect the download to start yet. Indexers may be warming up, and you have not reviewed provider settings. That is the next page.

### 5. Check container health

```bash
docker compose -f ~/arrstack/docker-compose.yml ps
```

Every service should report `healthy` or `running`. If any is `restarting`, look at its logs:

```bash
arrstack logs sonarr
```

## Common first-run issues

| Symptom                                      | Fix |
|----------------------------------------------|-----|
| `connection refused` on every port           | Docker did not start. `systemctl --user start docker` or `sudo systemctl start docker`. |
| Jellyfin says Startup Wizard not complete    | Wiring failed partway. Run `arrstack doctor`, then `arrstack install --resume`. |
| Prowlarr has 0 indexers                      | FlareSolverr did not come up in time. Restart it and rerun the resume. |
| Trailarr still shows default login           | Env file not read. `cat ~/arrstack/config/trailarr/.env` must show `API_KEY=`. |

When you are happy with the smoke test, move on to `03-daily-use.md` to see how the stack behaves under normal use.

## Next steps

- [03. Daily use](03-daily-use.md): end-to-end request flow from Jellyseerr to Jellyfin playback.
- [07. Providers setup](07-providers-setup.md): OpenSubtitles, Addic7ed, and the OpenRouter AI translator.
- [08. Backup and restore](08-backup-restore.md): back up `state.json` and `config/` now while things are fresh.
