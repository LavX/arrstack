# 03. Daily use

This page walks through a real user flow: a friend texts you a movie name, you request it in Jellyseerr, and 10 minutes later it plays on Jellyfin with subtitles and a trailer. You learn where files land at each stage and what to check when something stalls.

## TL;DR

```
Jellyseerr  ->  Radarr  ->  Prowlarr  ->  indexer  ->  qBittorrent
                                                       |
                                                       v
Jellyfin  <-  Bazarr+ (subs)  <-  Radarr import  <-  /data/torrents/movies
Trailarr (previews)
```

## The request flow, step by step

### 1. User requests in Jellyseerr

Open http://localhost:5055, log in with your admin user, search for `Dune Part Two`, click Request. You get a toast confirming the request.

Behind the scenes:

| Field                 | Value seeded by installer |
|-----------------------|---------------------------|
| Default 4K profile    | Enabled if you picked Radarr 4K during setup |
| Radarr root folder    | `/data/media/movies` |
| Radarr quality profile| TRaSH HD-1080p (from recyclarr) |
| Auto-approve          | Admin requests auto-approve, others queue |

### 2. Radarr receives and searches

Radarr wakes on the webhook from Jellyseerr, adds the movie, and immediately runs an interactive search across all Prowlarr-synced indexers.

Open http://localhost:7878, click Activity, Queue. Within 30 seconds you should see either a download in progress or a red "No results found" banner.

If searches return nothing, the most common causes, in order:

| Cause                                  | Check |
|----------------------------------------|-------|
| Cloudflare challenge on indexer        | Prowlarr, Indexers, red ring next to indexer name |
| Indexer rate limited                   | Prowlarr, History, look for 429 responses |
| FlareSolverr container not running     | `docker ps | grep flaresolverr` |
| Too-strict quality profile             | Radarr, Settings, Profiles, widen cutoff temporarily |

### 3. qBittorrent downloads

Radarr hands the chosen release to qBittorrent. Category is `radarr`, save path is `/data/torrents/movies` (inside the container, which is `~/arrstack/data/torrents/movies` on the host).

Open http://localhost:8080 to watch progress. Sonarr uses category `sonarr` with `/data/torrents/tv`. Music goes to `/data/torrents/music`.

If a download sits at 0% forever:

```bash
# Peer count from the container's perspective
docker exec -it qbittorrent sh -c 'cat /tmp/session.log 2>/dev/null | tail -40'

# Check your outbound IP (only meaningful if VPN is on)
docker exec -it qbittorrent sh -c 'curl -s ifconfig.me'
```

### 4. Import to library

When the download finishes, qBittorrent fires a webhook back to Radarr. Radarr hardlinks or moves the file into `/data/media/movies/Dune Part Two (2024)/Dune.Part.Two.2024.mkv` (inside-container path, same as host under `~/arrstack/data/`).

Hardlinks are the default. They save disk space and keep the torrent seedable from its original location. This only works if torrents and media live on the same filesystem, which is why the installer keeps them both under one storage root.

Verify on disk:

```bash
ls -l ~/arrstack/data/media/movies/ | tail -5
ls -li ~/arrstack/data/torrents/movies/ | tail -5   # same inode number means hardlink
```

### 5. Bazarr+ fetches subtitles

Bazarr+ watches Sonarr and Radarr. On a new import it runs its provider chain and drops subtitle files next to the video.

Subtitle path example:

```
~/arrstack/data/media/movies/Dune Part Two (2024)/
  Dune.Part.Two.2024.mkv
  Dune.Part.Two.2024.en.srt
  Dune.Part.Two.2024.en.forced.srt
```

Language profile rules applied by the installer:

| Flag                | Effect |
|---------------------|--------|
| `audio_exclude`     | Skip subtitle search for languages already in the audio track |
| `audio_only_include`| Only fetch subs for the opposite of the audio track |
| `hi`                | Fetch hearing-impaired variants if available |
| `forced`            | Fetch forced narrative subs separately |

The AI translator (LavX fork feature) only triggers when no human subtitle is found. Configure OpenRouter in `07-providers-setup.md`.

### 6. Trailarr grabs a preview

Trailarr polls Radarr, finds the new movie, and downloads a YouTube trailer to:

```
~/arrstack/data/media/movies/Dune Part Two (2024)/trailers/
  trailer.mkv
```

Jellyfin reads that folder automatically and shows a Play Trailer button on the movie page.

### 7. Jellyfin picks it up

Jellyfin scans libraries every 60 minutes by default, and on-demand when you click Scan All Libraries. Open http://localhost:8096, go to Movies, the new title should appear with a poster within one scan cycle.

Force a scan without waiting:

```bash
curl -X POST "http://localhost:8096/Library/Refresh" \
  -H "X-Emby-Token: $(cat ~/arrstack/config/jellyfin/data/api_key.txt)"
```

## TV shows

Same flow, different boxes. Request in Jellyseerr, Sonarr handles search and queue, downloads land in `/data/torrents/tv/`, imports go to `/data/media/tv/Show Name/Season 01/`. Sonarr watches for new episodes and grabs them automatically once a season is monitored.

## Keeping things tidy

| Task                        | Command |
|-----------------------------|---------|
| Prune old Docker layers     | `docker system prune` |
| Free space on torrents      | qBittorrent, right click, Delete (files stay in media via hardlink) |
| Force a full rescan         | Jellyfin, Dashboard, Libraries, Scan All |
| Refresh all metadata        | Radarr, System, Tasks, Refresh Monitored Movies |
| Check stack health          | `arrstack doctor` |

## Where to look when something is missing

| Missing         | First place to look |
|-----------------|---------------------|
| Movie not in Jellyfin | Radarr, Activity, History. Was it imported? |
| No subtitles    | Bazarr+, History. Did a provider respond? |
| No trailer      | Trailarr, Library, check YouTube rate limit |
| No poster art   | Jellyfin, click item, Edit Metadata, Refresh |

When everything routes cleanly, daily use is mostly Jellyseerr for requests and Jellyfin for playback. The rest runs itself.

## Next steps

- [07. Providers setup](07-providers-setup.md): better subtitle coverage and the OpenRouter AI translator.
- [05. Extra drives](05-extra-drives.md): when the first disk fills up.
- [09. Updating](09-updating.md): run `arrstack update` monthly, survive breaking changes.
