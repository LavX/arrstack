# 08. Backup and restore

Your media library is irreplaceable to you. Your configs took an hour of tuning to get right. This page tells you exactly what to back up (and what not to waste space on), how to restore to a fresh box, and what `--fresh` versus `--resume` actually do to your data.

## TL;DR

```bash
# Backup: state + configs + media (media is the big one)
tar -czf arrstack-configs-$(date +%F).tar.gz \
  ~/arrstack/state.json \
  ~/arrstack/admin.txt \
  ~/arrstack/config/

# Media: rsync to a separate disk, nightly
rsync -aAX --delete ~/arrstack/data/media/ /mnt/backup/media/

# Restore on a new box
arrstack install --fresh           # get a clean binary and compose
# stop containers, overwrite state + config, restart
```

## What to back up

Tiered by importance. Do the first tier always, the second if you value your time, the third only if disk is cheap.

### Tier 1: critical, small, irreplaceable config

| Path                              | Size     | Why |
|-----------------------------------|----------|-----|
| `~/arrstack/state.json`           | <10 KB   | Every wizard choice, port map, seeds |
| `~/arrstack/admin.txt`            | <1 KB    | Your admin password |
| `~/arrstack/config/`              | 100 MB to 2 GB | Sonarr/Radarr/Prowlarr SQLite DBs, Bazarr+ config, Jellyfin user prefs |
| `~/arrstack/FIRST-RUN.md`         | <10 KB   | Your URL list, nice to have |

Back these up daily if you can. They fit in a pocket-sized tarball.

### Tier 2: big, replaceable in theory, painful in practice

| Path                              | Size     | Why |
|-----------------------------------|----------|-----|
| `~/arrstack/data/media/`          | anywhere from 500 GB to 50 TB | Your movies, shows, music |

Theoretically replaceable because arrstack can re-download everything if you still have the request history. In practice, that means days of seeding, indexers that may no longer stock what you had, and bandwidth costs. Treat it as primary data.

### Tier 3: skippable

| Path                              | Size     | Why skippable |
|-----------------------------------|----------|---------------|
| `~/arrstack/data/torrents/`       | varies   | Reseedable, Radarr/Sonarr can re-grab |
| `~/arrstack/config/jellyfin/cache/` | GBs    | Thumbnail cache, regenerates |
| `~/arrstack/config/jellyfin/metadata/` | GBs  | Regenerates on library scan |
| `~/arrstack/config/jellyfin/transcodes/` | GBs | Temp transcode files |
| Docker images (`docker images`)   | 5-10 GB  | `arrstack update` pulls them back |

## Backup command recipes

### Nightly config snapshot

Add to a cron line or systemd timer:

```bash
#!/bin/bash
set -euo pipefail
DEST=/mnt/backup/arrstack-configs
mkdir -p "$DEST"
tar -czf "$DEST/arrstack-configs-$(date +%F).tar.gz" \
  --exclude='config/jellyfin/cache' \
  --exclude='config/jellyfin/metadata' \
  --exclude='config/jellyfin/transcodes' \
  -C "$HOME" \
  arrstack/state.json \
  arrstack/admin.txt \
  arrstack/config \
  arrstack/FIRST-RUN.md

# Keep last 14
ls -1t "$DEST"/arrstack-configs-*.tar.gz | tail -n +15 | xargs -r rm
```

### Nightly media mirror

```bash
rsync -aAXH --info=progress2 --delete \
  ~/arrstack/data/media/ /mnt/backup/media/
```

`-H` preserves hardlinks. Drop it if your backup target is a different filesystem type that does not support them (for example, SMB).

### Off-site: rclone to an S3-compatible bucket

```bash
# One-time: configure a remote named "b2"
rclone config

# Daily: encrypt and sync
rclone sync /mnt/backup/arrstack-configs b2:arrstack-backups/configs --transfers 4
rclone sync ~/arrstack/data/media       b2:arrstack-backups/media    --transfers 4 --bwlimit 10M
```

For sensitive data use `rclone config` with a `crypt` remote wrapping the bucket.

### Stopping containers for a consistent snapshot

SQLite can be copied hot most of the time, but for a guaranteed-consistent config backup stop the stack first:

```bash
docker compose -f ~/arrstack/docker-compose.yml stop
tar -czf configs.tar.gz -C ~ arrstack/config arrstack/state.json arrstack/admin.txt
docker compose -f ~/arrstack/docker-compose.yml start
```

## Restore workflow

### Same host, rebuild from backup

```bash
# Stop everything
docker compose -f ~/arrstack/docker-compose.yml down

# Move old out of the way
mv ~/arrstack ~/arrstack.broken.$(date +%s)

# Restore config tarball
mkdir -p ~/arrstack
tar -xzf /mnt/backup/arrstack-configs/arrstack-configs-2026-04-16.tar.gz -C ~/

# Reinstall the binary if missing
curl -fsSL https://lavx.github.io/arrstack/install.sh | bash

# Rebuild compose and bring up
arrstack install --resume
```

`--resume` detects the restored `state.json` and skips straight to compose generation and container start. The arr SQLite DBs under `config/` are already seeded, the wizard does not re-seed them.

### New host, lift and shift

Prereqs on the new host: Docker, Compose v2, same PUID/PGID as the old host (or chown everything on restore). Install command:

```bash
# 1. Install binary
curl -fsSL https://lavx.github.io/arrstack/install.sh | bash

# 2. Restore configs to the same layout
mkdir -p ~/arrstack
tar -xzf arrstack-configs-backup.tar.gz -C ~/

# 3. Restore media (this takes hours to days depending on size)
rsync -aAXH /mnt/external/media/ ~/arrstack/data/media/

# 4. Resume wizard to regenerate compose
arrstack install --resume
```

If PUID/PGID differ, chown first:

```bash
sudo chown -R $(id -u):$(id -g) ~/arrstack
```

### Single-service recovery

If only Sonarr is corrupted (power loss during write, for example):

```bash
docker compose -f ~/arrstack/docker-compose.yml stop sonarr
rm -rf ~/arrstack/config/sonarr
tar -xzf /mnt/backup/arrstack-configs/arrstack-configs-2026-04-16.tar.gz \
  -C ~/ arrstack/config/sonarr
docker compose -f ~/arrstack/docker-compose.yml start sonarr
```

## `--fresh` vs `--resume`, exactly

| Flag                | Touches `state.json`                 | Touches `~/arrstack/config/`                                  | Touches `~/arrstack/data/` | When to use |
|---------------------|--------------------------------------|---------------------------------------------------------------|----------------------------|-------------|
| `--resume`          | Reads existing, rewrites at the end  | Leaves existing files, re-creates missing dirs and seed files | Leaves alone               | Continue after a partial install, restore, or repair missing config |
| `--fresh`           | Ignores existing, writes fresh       | Overwrites seeded files (`.env`, Caddyfile, `config.xml`, `config.yaml`, dnsmasq.conf, etc.) in place; does not delete existing service DBs | Leaves alone               | Start over from a clean wizard without re-creating media |
| `uninstall`         | Preserves                            | Preserves                                                     | Preserves                  | Stop running, keep everything (`docker compose down`) |
| `uninstall --purge` | Preserves                            | **Deletes** `~/arrstack/config/`                              | Preserves                  | Wipe service state but keep media |

`--fresh` never deletes anything under `~/arrstack`. It simply re-renders every file the installer owns, which means existing service databases survive and may conflict with the fresh seed. If you want a truly clean slate, run `arrstack uninstall --purge` first, then `arrstack install --fresh`. Your media (`data/media`, `data/torrents`) is never touched by either flag.

## Testing your backup

A backup you have never restored is a hope, not a backup. Quarterly drill:

1. Spin up a disposable Linux VM.
2. Copy the latest config tarball to it.
3. Install arrstack, restore the tarball, run `--resume`.
4. Open Sonarr, check your series are visible.
5. Destroy the VM.

If that flow works end to end, you can restore for real on a bad night.

## What the installer does NOT back up for you

arrstack has no built-in scheduled backup yet. Arrange your own cron line or systemd timer pointing at a script that runs the tarball and rsync commands from the Backup command recipes section above. Enable with `systemctl --user enable --now your-timer.timer`.

## Next steps

- [09. Updating](09-updating.md): always take a Tier 1 backup before `arrstack update`.
- [05. Extra drives](05-extra-drives.md): extend your rsync target when you add storage.
- [01. Installation](01-installation.md): the `--fresh` and `--resume` flags your restore workflow depends on.
