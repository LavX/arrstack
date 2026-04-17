# 09. Updating

arrstack uses `:latest` tags for every service image. Updates are a single command that pulls, recreates, and restarts containers in dependency order. This page explains what `arrstack update` does, how to handle breaking changes announced by upstream services, and how to pin or roll back when a new image breaks something.

## TL;DR

```bash
# Update all images, restart in order, run health checks
arrstack update

# Update a single service
arrstack update sonarr

# Update the arrstack binary itself
curl -fsSL https://lavx.github.io/arrstack/install.sh | bash

# Verbose mode, see every step
arrstack update --verbose
```

## What `arrstack update` does

1. Checks the arrstack binary version against the GitHub release feed. Warns if you are behind.
2. Runs `docker compose pull` for every enabled service.
3. Runs `docker compose up -d` which only recreates containers with changed images.
4. Waits for health checks to go green.
5. Re-runs the idempotent slices of auto-wiring (Prowlarr app sync, Jellyseerr library enable, Trailarr key refresh) in case the new images reset anything.
6. Prunes dangling images to free disk.
7. Prints a summary: which services changed tag, which stayed.

Duration: 30 seconds to 5 minutes depending on image sizes and download speed.

## Image tag policy

Every service image uses the `:latest` tag by default. Rationale:

| Pro                                 | Con |
|-------------------------------------|-----|
| Security patches arrive in one `update` | Breaking changes can land without you noticing |
| No manual version tracking per service | Coordinated downgrades are harder |
| Matches the LinuxServer.io defaults  | Diagnostic commands show `latest` not a version |

If you want pinned versions, see the Pinning section below.

## When to update

| Cadence           | Who should pick this |
|-------------------|----------------------|
| Monthly           | Most users. Good balance. |
| Weekly            | Active users who watch changelogs |
| On release notice | When you spot a CVE or a feature you want |
| Never             | "If it works" crowd. Do at least quarterly for security. |

Skipping updates for 6+ months risks a painful diff because config formats can shift beneath you.

## Handling breaking changes

Some upstream projects publish breaking changes under `:latest`. The usual suspects:

| Service   | Historical break points |
|-----------|-------------------------|
| Sonarr    | v3 to v4 migration, API path changes |
| Radarr    | Custom format schema updates |
| Jellyfin  | 10.8 to 10.9 server setup reset in some upgrade paths |
| qBittorrent | Login API changes between 4.x and 5.x |
| Prowlarr  | IndexerProxy model tweaks |

### Before running `update`

1. Skim the release notes for each service (LinuxServer.io posts them in their Discord and blog).
2. Run a Tier 1 backup, `08-backup-restore.md`.
3. Note the current image digests:

```bash
docker inspect --format='{{.Image}}' sonarr radarr prowlarr
```

### After running `update`

Run `arrstack doctor`. It checks:

- Every container is `running` and `healthy`
- API keys still valid
- Prowlarr still pushes indexers to Sonarr/Radarr
- Jellyfin library scan succeeds
- Caddy cert is still valid

If anything fails, logs tell the story:

```bash
arrstack logs sonarr
arrstack logs --since 10m
```

## Rollback via image pinning

When `:latest` breaks something, pin to the last good tag until upstream fixes it.

### Find the previous working tag

```bash
# Pull history of tags for the image
docker run --rm quay.io/skopeo/stable list-tags docker://lscr.io/linuxserver/sonarr | head -40
```

Pick the tag that was running before the update. If unsure, check the LinuxServer.io changelog.

### Pin it in the override file

arrstack generates `docker-compose.yml`. Do not edit it by hand, it is regenerated on every `update` and `install --resume`. Instead, use the override file:

```yaml
# ~/arrstack/docker-compose.override.yml
services:
  sonarr:
    image: lscr.io/linuxserver/sonarr:4.0.5
```

```bash
docker compose -f ~/arrstack/docker-compose.yml \
               -f ~/arrstack/docker-compose.override.yml \
               up -d sonarr
```

Verify:

```bash
docker inspect --format='{{.Config.Image}}' sonarr
# lscr.io/linuxserver/sonarr:4.0.5
```

### Making the pin stick through future `update`

`arrstack update` respects the override file. It runs `docker compose -f compose.yml -f override.yml pull` and `up -d`. The pin stays until you remove or change it.

To unpin later, edit the override and remove the `image:` line, then run `arrstack update sonarr`.

## Updating the arrstack binary itself

Different from updating services. The binary handles wizard, wiring, and lifecycle. It updates independently of Docker images.

```bash
# Re-download the installer script, which replaces the binary
curl -fsSL https://lavx.github.io/arrstack/install.sh | bash

# Confirm new version
arrstack --version
```

Binary updates are backward compatible with existing `state.json`. If a new binary introduces a state migration, it runs automatically on the next `install --resume`.

## Skipping a service during update

Sometimes you want to hold one service back while updating the rest:

```bash
# Update everything except Jellyfin
for s in sonarr radarr prowlarr bazarr qbittorrent flaresolverr trailarr jellyseerr recyclarr caddy; do
  arrstack update "$s"
done
```

Or use the override file to pin the specific service before running `arrstack update`.

## Canary one service first

If you are nervous about an update, run a dry pass on one service:

```bash
# Only Prowlarr (lowest blast radius, no persistent downloads)
arrstack update prowlarr

# If healthy, continue with the rest
arrstack update
```

## What breaks and how to spot it

| Symptom after update                  | Likely cause | Fix |
|---------------------------------------|--------------|-----|
| Sonarr/Radarr login loop              | DB schema migration needed. Check logs. | Usually self-heals on second restart. |
| Prowlarr loses all indexers           | Major Prowlarr version with broken migration | Restore `config/prowlarr` from backup, roll image back. |
| Jellyfin asks for Startup Wizard      | Config path moved | Roll image back, file an issue, wait for upstream fix. |
| FlareSolverr 500 errors               | Cloudflare changed challenge, FS needs its own update | `arrstack update flaresolverr` |
| qBittorrent WebUI shows login fail    | 5.x auth flow change | Update qBittorrent indexer clients in Sonarr/Radarr (Settings, Download Clients). |

## Log where update ran

Every `arrstack update` run appends to `~/arrstack/update.log` with timestamps, pulled tags, and health-check results. Useful evidence when asking for help.

```bash
tail -n 100 ~/arrstack/update.log
```

## Recommended monthly routine

```bash
# 1. Backup
~/bin/arrstack-backup.sh

# 2. Update binary
curl -fsSL https://lavx.github.io/arrstack/install.sh | bash

# 3. Update services
arrstack update

# 4. Verify
arrstack doctor

# 5. Test a request end to end
# Request a movie in Jellyseerr, wait for Radarr to grab it, confirm Jellyfin plays it.
```

15 minutes a month buys you current images, fresh certs, and a system you can trust to work when you actually want to watch something.

## Next steps

- [08. Backup and restore](08-backup-restore.md): take a Tier 1 snapshot before every update.
- [02. First run](02-first-run.md): re-run the smoke test after a major version bump.
- [04. Remote access](04-remote-access.md): Caddy cert renewals ride along with `arrstack update`.
