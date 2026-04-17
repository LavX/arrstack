# Per-service FAQ

Quirks, gotchas, and the kind of questions that show up in issues for each of the 12 services. Entries are grounded in the installer's wiring (`src/wiring/*.ts`) and catalog (`src/catalog/services.yaml`), not generic upstream docs.

All paths assume the default install dir `~/arrstack`.

---

## qBittorrent

**Q: Where do I find the temporary WebUI password?**
A: qBittorrent prints a random password to its logs on first boot. The installer captures it, stores it in `admin.txt`, and then applies your chosen password via the WebUI API. If you missed it:
```bash
arrstack logs qbittorrent | grep -i 'temporary password'
arrstack show-password
```

**Q: Downloads land in the wrong folder.**
A: The container sees the host's storage root as `/data`. Category paths inside qBittorrent must be `/data/torrents/<category>`, not host paths. The installer seeds `tv`, `movies`, `music`, `books` categories automatically.

**Q: Sonarr says "the download client returned an HTTP 401".**
A: The WebUI username or password was changed outside the installer. Re-sync by running `arrstack install --resume`, which writes the current credentials back into Sonarr and Radarr.

**Q: Is port 8080 exposed to my LAN by default?**
A: Only if you picked LAN mode in the wizard. In `none` mode ports bind to `127.0.0.1`. See the LAN-binding entry in `common-errors.md`.

**Q: Where are the container logs?**
A: `arrstack logs qbittorrent` follows the stream. One-off dump of the last 500 lines without following:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 qbittorrent
```

---

## Prowlarr

**Q: I added a FlareSolverr-needing indexer and it does not scrape.**
A: The FlareSolverr tag must be attached to the indexer at create time, and FlareSolverr must be registered as an indexer proxy first. The installer creates proxy -> apps -> indexers in that order. If you are adding an indexer by hand:
1. Settings -> Indexers -> check "FlareSolverr" tag.
2. Click "Sync App Indexers" after save.

**Q: Prowlarr shows "0 indexers" synced even though I have 5 configured.**
A: Apps must exist before you create indexers for Prowlarr to push them. Re-run `arrstack install --resume` so wiring happens in the right order.

**Q: The TorrentGalaxy indexer fails to save.**
A: The upstream definition was removed. Use `TorrentGalaxyClone` instead. The installer's indexer list is already updated.

**Q: Where is Prowlarr's API key?**
A: `docker exec arrstack-prowlarr-1 sed -n 's#.*<ApiKey>\(.*\)</ApiKey>.*#\1#p' /config/config.xml` or `jq -r .api_keys.prowlarr ~/arrstack/state.json`.

**Q: Where are the container logs?**
A: `arrstack logs prowlarr`. Or inside `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 prowlarr
```
The on-disk log (`/config/logs/prowlarr.txt`) is more verbose:
```bash
docker exec arrstack-prowlarr-1 tail -n 500 /config/logs/prowlarr.txt
```

---

## FlareSolverr

**Q: Prowlarr log says "FlareSolverr endpoint did not respond".**
A: Check the health endpoint directly:
```bash
docker exec arrstack-prowlarr-1 wget -qO- http://flaresolverr:8191/health
```
It should return JSON with `"status": "ok"`. If it does not, `arrstack logs flaresolverr` and look for Chromium startup errors.

**Q: FlareSolverr pegs one CPU core.**
A: It launches a full Chromium for every challenge. Expect bursts under load. Cap it in compose if needed:
```yaml
services:
  flaresolverr:
    cpus: 1.5
```

**Q: LOG_LEVEL=debug floods the log.**
A: Default is `info` in the catalog. Change it in `docker-compose.yml` or via `arrstack install --resume` after editing the wizard's services list.

**Q: Where are the container logs?**
A: `arrstack logs flaresolverr`. Or from `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 flaresolverr
```
FlareSolverr only logs to stdout, so the compose logs are the whole picture.

---

## Sonarr

**Q: No indexers appear after first install.**
A: Prowlarr pushes indexers to Sonarr over the app connection, so Prowlarr must be configured first. If Sonarr is empty, go to Prowlarr -> Apps -> Sonarr -> "Sync App Indexers".

**Q: Sonarr cannot reach qBittorrent.**
A: Download client host must be `qbittorrent`, not `localhost` or an IP. The installer writes it correctly; if you changed it by hand:
- Host: `qbittorrent`
- Port: `8080`
- Category: `tv`

**Q: Recyclarr did not update my profiles.**
A: Recyclarr runs on a cron inside the container, not on-demand. Force it:
```bash
docker compose -f ~/arrstack/docker-compose.yml run --rm recyclarr sync
```

**Q: Where is the Sonarr API key?**
A: `arrstack show-password` prints it. Or see `/config/config.xml` inside the container.

**Q: Where are the container logs?**
A: `arrstack logs sonarr`. Or inside `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 sonarr
```
The rolling on-disk log (`/config/logs/sonarr.txt`) has more detail than stdout:
```bash
docker exec arrstack-sonarr-1 tail -n 500 /config/logs/sonarr.txt
```

---

## Radarr

**Q: Imported movies show wrong quality.**
A: Recyclarr-managed quality profiles are regenerated on sync. If you renamed a profile in Radarr, it gets recreated on the next Recyclarr run. Keep customizations in your `recyclarr.yml`, not in Radarr's UI.

**Q: Radarr says "Remote path mapping needed".**
A: It does not. Your qBittorrent download client is configured with a host path instead of the container path `/data`. Remove any remote path mappings and reset the client config to the installer defaults with `arrstack install --resume`.

**Q: Root folder `/data/media/movies` shows 0 free space.**
A: The container's `/data` is bind-mounted from your storage root. If the host shows free space but the container does not, the mount is stale. Restart: `docker compose -f ~/arrstack/docker-compose.yml restart radarr`.

**Q: Where are the container logs?**
A: `arrstack logs radarr`. Or from `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 radarr
```
On-disk log inside the container:
```bash
docker exec arrstack-radarr-1 tail -n 500 /config/logs/radarr.txt
```

---

## Bazarr+

**Q: The provider login fields are empty.**
A: Bazarr+ does not ship with provider credentials. You must log in to each provider yourself:
- OpenSubtitles.com (the new one, not .org)
- Subf2m, Addic7ed, etc. as desired
- Opensubtitles-scraper side-car handles rate-limited scraping

**Q: Subtitle editor shows "Failed to parse subtitle file".**
A: The editor uses `crypto.randomUUID()` which requires a secure context. Access Bazarr via HTTPS (the Caddy vhost) or via `http://localhost:6767` on the Docker host.

**Q: AI translation does nothing.**
A: Set `OPENROUTER_API_KEY` in `~/arrstack/.env` and restart Bazarr and `ai-subtitle-translator`. Both containers share an `ENCRYPTION_KEY` so the API key can be AES-GCM-encrypted when one calls the other.

**Q: Language profile crashes Bazarr with `KeyError`.**
A: Every profile item must include `audio_exclude`, `audio_only_include`, `hi`, and `forced`. See the error catalog entry.

**Q: Where is the config file, really?**
A: Inside the container: `/config/config/config.yaml`. On the host: `~/arrstack/config/bazarr/config/config.yaml`. The double-`config` is intentional for the Bazarr+ image.

**Q: Where are the container logs?**
A: `arrstack logs bazarr`. Or from `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 bazarr
```
Bazarr+ also writes to `/config/log/bazarr.log` inside the container:
```bash
docker exec arrstack-bazarr-1 tail -n 500 /config/log/bazarr.log
```

---

## OpenSubtitles Scraper

**Q: Scraper logs show "FlareSolverr not reachable".**
A: The scraper uses `http://flaresolverr:8191/v1`. Confirm FlareSolverr is up with the network reachability recipe in `diagnostic-commands.md`.

**Q: How often does it run?**
A: On its internal schedule; check `docker exec arrstack-opensubtitles-scraper-1 cat /app/config.yml` for the cron expression.

**Q: Bazarr shows no subtitles even with the scraper enabled.**
A: Bazarr must point at the scraper URL, which the installer sets via `OPENSUBTITLES_SCRAPER_URL=http://opensubtitles-scraper:8000`. Verify it is present in Bazarr's `config.yaml` under the providers section.

**Q: Where are the container logs?**
A: `arrstack logs opensubtitles-scraper`. Or from `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 opensubtitles-scraper
```
The scraper logs every FlareSolverr round-trip, so greping for `status` is useful:
```bash
arrstack logs opensubtitles-scraper | grep -iE 'status|error'
```

---

## AI Subtitle Translator

**Q: Translation requests fail with "invalid encryption key".**
A: Bazarr and the translator must share the same `ENCRYPTION_KEY` env var. Both read it from the same `.env` at compose time. Run `arrstack install --resume` to regenerate and sync.

**Q: Which models work?**
A: Any OpenRouter-hosted model your key can reach. Cheap defaults are `anthropic/claude-3.5-haiku` and `openai/gpt-4o-mini`. Set the preferred model in Bazarr's AI provider settings.

**Q: It never picks up new subtitle files.**
A: It only translates when Bazarr calls it. Trigger a manual translation in Bazarr's UI to confirm the link works end-to-end.

**Q: Where are the container logs?**
A: `arrstack logs ai-subtitle-translator`. Or from `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 ai-subtitle-translator
```
Encryption/decryption errors from Bazarr appear here, not in Bazarr's own log.

---

## Jellyfin

**Q: How do I verify hardware transcoding is actually happening?**
A: Start a transcode-forcing stream (e.g. a 10-bit HEVC file on a client that needs AVC), then inside the container:
```bash
docker exec arrstack-jellyfin-1 ps -ef | grep ffmpeg
```
The ffmpeg line should include `-hwaccel` plus your vendor's flag: `vaapi` for Intel/AMD, `cuda` or `nvdec` for NVIDIA. Also see `gpu-transcoding-debug.md`.

**Q: My admin user lost admin rights.**
A: See the "admin user created but not administrator" entry in `common-errors.md`. Run `arrstack install --resume`.

**Q: Library scan shows "permission denied".**
A: The container runs as `PUID:PGID` (from state). If your media files are owned by a different UID/GID, chown them or change `puid`/`pgid` in `state.json` and `arrstack install --resume`.

**Q: Port 8096 responds but the UI is blank.**
A: First-run wizard may not have completed. `arrstack install --resume` will drive it to completion, or you can walk through `http://<host>:8096/web/wizardstart.html` by hand.

**Q: Where are the container logs?**
A: `arrstack logs jellyfin`. Or from `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 jellyfin
```
For the transcode-specific log (most useful during GPU debugging):
```bash
docker exec arrstack-jellyfin-1 \
  tail -n 500 /config/log/FFmpeg.Transcode-$(date +%Y-%m-%d).log
```

---

## Jellyseerr

**Q: Setup page keeps reappearing.**
A: All four bootstrap steps (auth, library sync, library enable, initialize) must succeed. See the `common-errors.md` entry.

**Q: It cannot reach Jellyfin at `http://jellyfin:8096`.**
A: Both containers must be on the same compose network (they are, by default). Test from inside Jellyseerr:
```bash
docker exec arrstack-jellyseerr-1 wget -qO- http://jellyfin:8096/System/Info/Public
```

**Q: I re-ran the installer and login now fails with a 500.**
A: The `hostname` field can only be set once. The installer drops it on subsequent bootstraps.

**Q: Where does Jellyseerr store its settings?**
A: `/app/config/settings.json` inside the container, `~/arrstack/config/jellyseerr/settings.json` on the host.

**Q: Where are the container logs?**
A: `arrstack logs jellyseerr`. Or from `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 jellyseerr
```
On-disk log (rotates daily) inside the container:
```bash
docker exec arrstack-jellyseerr-1 tail -n 500 /app/config/logs/overseerr.log
```

---

## Caddy

**Q: Services 404 through the reverse proxy.**
A: Caddy routes by Host header. If you are browsing via an IP, vhosts will not match. Use the hostnames Caddy serves (e.g. `sonarr.arrstack.local`) or point a client's `/etc/hosts` at the server IP.

**Q: HTTPS certificates fail on first boot.**
A: In LAN mode, Caddy generates a local CA and self-signed certs. You must trust the CA on your client (download from `http://<host>/ca.crt`). In remote mode (`duckdns`/`cloudflare`), Caddy solves a DNS-01 ACME challenge and issues a real Let's Encrypt wildcard cert. That requires the matching DNS plugin, and the stock `caddy:latest` image does not ship any. The installer builds a custom image with `xcaddy` that embeds `caddy-dns/cloudflare` (or `caddy-dns/duckdns`). If the build failed, the log line in `arrstack logs caddy` will say `failed to load module "dns.providers.cloudflare"`. Re-run `arrstack update` to rebuild.

Note: `cloudflare` mode is Cloudflare DNS + Caddy wildcard LE via DNS-01. It is not Cloudflare Tunnel. Traffic still reaches your server directly on 80/443, so port forwarding and firewall rules still apply. See the "UFW blocks port 443" entry in `common-errors.md`.

**Q: Caddy logs say "tls: failed to load cert".**
A: Config volume permissions got mangled. Reset:
```bash
docker compose -f ~/arrstack/docker-compose.yml stop caddy
sudo chown -R 0:0 ~/arrstack/config/caddy
docker compose -f ~/arrstack/docker-compose.yml up -d caddy
```

**Q: How do I reload config without downtime?**
A: `docker exec arrstack-caddy-1 caddy reload --config /etc/caddy/Caddyfile`.

**Q: Where are the container logs?**
A: `arrstack logs caddy`. Or from `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 caddy
```
Caddy's access log and ACME cert events are on stdout, so the compose log is authoritative. Filter for cert issuance:
```bash
arrstack logs caddy | grep -iE 'certificate|acme|dns-01'
```

---

## Recyclarr

**Q: How often does it sync?**
A: On a cron inside the container (default once per day). Run it now:
```bash
docker compose -f ~/arrstack/docker-compose.yml run --rm recyclarr sync
```

**Q: "Include templates are not supported."**
A: Recyclarr v8 dropped includes. Profiles must be inlined with `qualities` and `upgrade.until_quality`. See `src/renderer/recyclarr-config.ts` for the shape the installer emits.

**Q: Sonarr profiles get renamed back after every sync.**
A: That is Recyclarr doing its job. Keep customizations in `~/arrstack/config/recyclarr/recyclarr.yml`, not in the Sonarr UI.

**Q: Where are the container logs?**
A: `arrstack logs recyclarr`. Or from `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 recyclarr
```
Recyclarr runs as a cron, so the most recent sync is at the tail. Full history:
```bash
docker exec arrstack-recyclarr-1 ls -lt /config/logs/
docker exec arrstack-recyclarr-1 cat /config/logs/recyclarr.log
```

---

## Trailarr

**Q: Health check fails even though the container is running.**
A: Port is 7889 (not 7879) and the health path is `/status` (not `/`). The installer catalog has this right; `arrstack update` fixes old installs.

**Q: Trailarr does not see my Jellyfin libraries.**
A: Trailarr reads libraries via the Jellyfin API. In the Trailarr UI, add Jellyfin with URL `http://jellyfin:8096` and the API key from `arrstack show-password`. Then select libraries in Settings -> Libraries.

**Q: Trailers download but Jellyfin does not show them.**
A: Jellyfin looks for trailers alongside the media file as `<movie>-trailer.<ext>` or in a `trailers/` subfolder. Check Trailarr's output path setting matches your Jellyfin library layout.

**Q: Where are the container logs?**
A: `arrstack logs trailarr`. Or from `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 trailarr
```
yt-dlp errors from failed downloads show up here, one per attempted trailer.

---

## Gluetun (optional VPN)

**Q: qBittorrent is reachable but its IP is not the VPN IP.**
A: qBittorrent must use Gluetun's network namespace. In compose:
```yaml
services:
  qbittorrent:
    network_mode: "service:gluetun"
```
The installer adds this when VPN mode is on. Verify from inside the container:
```bash
docker exec arrstack-qbittorrent-1 wget -qO- https://ifconfig.me
```

**Q: Gluetun keeps restarting.**
A: Usually bad credentials or wrong provider settings in `~/arrstack/.env`. `arrstack logs gluetun` will print the specific auth error from your VPN provider.

**Q: DNS leaks.**
A: Gluetun forces DNS through the tunnel by default (`DOT=on`). Do not override unless you know what you are doing.

**Q: Where are the container logs?**
A: `arrstack logs gluetun`. Or from `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 gluetun
```
Startup failures (bad creds, unreachable provider) print right at the top, so `--tail 50` is usually enough when it is stuck in a restart loop.

---

## dnsmasq (optional local DNS)

**Q: Hostnames do not resolve on client devices.**
A: Clients must point at the host running dnsmasq (port 53). On macOS/Linux you can set this in your router's DHCP, or per-device. Windows clients may need a manual DNS entry on the adapter.

**Q: Can I disable dnsmasq and still use hostnames?**
A: Yes. Set `install_dnsmasq: false` in state (or in the wizard). Add entries to each client's `/etc/hosts` pointing at the server IP.

**Q: Port 53 already in use.**
A: `systemd-resolved` listens on 53 by default on Ubuntu. Either disable its stub listener or skip dnsmasq. The installer's port conflict detection will warn you.

**Q: Where are the container logs?**
A: `arrstack logs dnsmasq`. Or from `${installDir}`:
```bash
docker compose -f ~/arrstack/docker-compose.yml logs --tail 500 dnsmasq
```
Every DNS query is logged at `info` level, so expect volume. Filter to your own hostnames:
```bash
arrstack logs dnsmasq | grep arrstack.local
```
