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

1. Seeds the admin user into Sonarr, Radarr, Prowlarr, and Bazarr+ SQLite databases. Auth is set to `authenticationMethod=Forms`, `authenticationRequired=Enabled`.
2. Creates a Prowlarr tag called `flaresolverr`, adds FlareSolverr as an indexer-proxy, and pushes 8 public indexers with the tag attached at create time (required for FS routing): 1337x, TorrentGalaxyClone, EZTV, The Pirate Bay, YTS, LimeTorrents, Torrent Downloads, Magnet Cat.
3. Connects Prowlarr to Sonarr and Radarr as `IndexerProxy` apps with `syncLevel=fullSync`, then runs a full sync.
4. Writes Bazarr+ `config.yaml` with form auth, a PBKDF2-SHA256 (600k iterations) password hash, and language profiles that include `audio_exclude`, `audio_only_include`, `hi`, and `forced` flags.
5. Waits for Jellyfin `/Startup/User` to return 200, walks the Startup Wizard, creates the admin user, and adds libraries: Movies at `/data/media/movies`, TV at `/data/media/tv`, Music at `/data/media/music`.
6. Runs Jellyseerr's 4-step bootstrap: `auth/jellyfin` with `serverType=2` and hostname, library sync, library enable, initialize. Links Sonarr and Radarr with `activeProfileId=1`.
7. Reads the Trailarr API key from `~/arrstack/config/trailarr/.env`, changes the default `admin/trailarr` login, and seeds Sonarr and Radarr connections.
8. Runs `recyclarr sync` to apply TRaSH Guides quality profiles.

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
| 7     | Bazarr+     | http://localhost:6767        | Providers page empty (you add these in `07-providers-setup.md`) |
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
