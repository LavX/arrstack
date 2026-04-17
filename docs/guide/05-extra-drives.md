# 05. Extra drives

Your boot SSD is full, or you bought a 14 TB HDD for movies, and you want arrstack to use it without rebuilding libraries. This page shows how to mount a new drive, tell arrstack about it, and extend Jellyfin, Sonarr, and Radarr to scan it alongside the original storage root.

## TL;DR

```bash
# 1. Mount the new drive persistently
sudo blkid /dev/sdb1           # grab the UUID
sudo mkdir -p /mnt/movies2
sudo tee -a /etc/fstab <<'EOF'
UUID=<paste-uuid>  /mnt/movies2  ext4  defaults,nofail  0  2
EOF
sudo mount -a

# 2. Re-run wizard, add the path to Extra scan paths
arrstack install --resume

# 3. arrstack mounts it at /data/extra-0 inside every content container
#    (second extra drive becomes /data/extra-1, third /data/extra-2, and so on)
```

## How arrstack handles extra drives

The rule: media and torrents should live on a single filesystem so hardlinks work. Extra drives are **additional library locations**, they are not a replacement for the main storage root.

When you add an Extra scan path at `/mnt/movies2`, arrstack bind-mounts it into every content container:

| Container   | Host path        | Container path  |
|-------------|------------------|-----------------|
| Jellyfin    | `/mnt/movies2`   | `/data/extra-0` |
| Sonarr      | `/mnt/movies2`   | `/data/extra-0` |
| Radarr      | `/mnt/movies2`   | `/data/extra-0` |
| Bazarr+     | `/mnt/movies2`   | `/data/extra-0` |
| qBittorrent | `/mnt/movies2`   | `/data/extra-0` |

Numbering is zero-indexed in the order the paths are listed in the wizard. Add a second one, it becomes `/data/extra-1`. Third is `/data/extra-2`. The order is stable across restarts because it is stored as `extra_paths` in `state.json`.

Only services that already carry a `/data` mount (the media and download pipeline) get extra drives bound in; utility services such as Recyclarr, Prowlarr, and Jellyseerr do not.

## Step 1. Prepare the drive on the host

Skip this if you already mount the drive at boot.

```bash
# Identify the disk, confirm it is not the system disk
lsblk -f

# Partition (GPT, single partition)
sudo parted /dev/sdb -- mklabel gpt mkpart primary ext4 0% 100%

# Format
sudo mkfs.ext4 -L movies2 /dev/sdb1

# Pick a mount point
sudo mkdir -p /mnt/movies2
```

Mount persistently. Use UUID, not `/dev/sdb1`, because device names can shuffle across reboots.

```bash
sudo blkid /dev/sdb1
# /dev/sdb1: LABEL="movies2" UUID="a1b2c3d4-..." TYPE="ext4" PARTUUID="..."

sudo tee -a /etc/fstab <<'EOF'
UUID=a1b2c3d4-...  /mnt/movies2  ext4  defaults,nofail,x-systemd.device-timeout=10  0  2
EOF

sudo mount -a
mount | grep movies2
```

Set ownership to your PUID:PGID from the wizard (your regular user in most cases):

```bash
sudo chown -R $(id -u):$(id -g) /mnt/movies2
```

## Step 2. Tell the wizard about it

```bash
arrstack install --resume
```

Navigate to the Storage screen. Under Extra scan paths, press `a` to add, paste `/mnt/movies2`, confirm. Repeat for each extra drive. Finish the wizard, containers are recreated with the new bind mounts.

Verify inside a container:

```bash
docker exec -it radarr ls /data/extra-0
```

You should see the contents of the drive.

## Step 3. Extend libraries without rebuilding

This is the part most users miss. Adding the mount does not automatically add library paths in Sonarr, Radarr, or Jellyfin. You tell each one to scan the new location as an **additional** path, not a replacement.

### Sonarr, adding a second root folder

1. Settings, Media Management.
2. Root Folders, Add Root Folder.
3. Enter `/data/extra-0/tv` (create it inside the container first if needed: `docker exec -it sonarr mkdir -p /data/extra-0/tv`).
4. Save.

Existing series keep their old root folder. New series are placed on whichever root folder you pick at add time, or whatever default Jellyseerr sends.

To move existing shows to the new drive:

1. Sonarr, Series, select multiple.
2. Mass Editor, Root Folder, pick `/data/extra-0/tv`, Save.
3. Sonarr moves files, updates its DB. Expect hours for large libraries.

### Radarr, same idea

Settings, Media Management, Root Folders, add `/data/extra-0/movies`. Move existing movies via Movies, Mass Editor.

### Jellyfin, adding a library folder

1. Dashboard, Libraries.
2. Click your Movies library, Manage Library.
3. Add Folder, `/data/extra-0/movies`.
4. Save. Scan.

Jellyfin now indexes both `/data/media/movies` and `/data/extra-0/movies` under one Movies library. Users see a single, combined list.

## Common layouts

### Pattern A: spill-over

Primary storage full, new drive holds overflow. Files split across drives in the same logical library. Jellyfin merges them into one library.

```
/data/media/movies/          <- filling up
/data/extra-0/movies/        <- new additions go here
```

### Pattern B: separate library by content type

Keep 4K releases on the fast drive, 1080p on the big HDD.

```
/data/media/movies/          <- 1080p Radarr instance default
/data/extra-0/movies-4k/     <- 4K Radarr instance (if you set one up)
```

### Pattern C: archive

Rarely-touched content on a spinning disk.

```
/data/media/movies/          <- active
/data/extra-0/archive/       <- cold movies, still playable
```

## What not to do

| Do not                                 | Why |
|----------------------------------------|-----|
| Symlink the extra drive into `/data/media/` | Breaks hardlinks, arrs will copy not hardlink |
| Change the numbering in `state.json`   | Bind mounts get out of sync with library paths |
| Mount without `nofail`                 | A missing disk at boot blocks systemd |
| Remove a drive without moving its content | Sonarr/Radarr will see missing files on every scan |

## Removing a drive

1. Move any files off it first. Use Sonarr/Radarr mass editor to change root folder back.
2. Remove the library path in Jellyfin.
3. Rerun the wizard, remove the path from Extra scan paths.
4. Unmount: `sudo umount /mnt/movies2` and remove the fstab line.
5. `arrstack install --resume` regenerates compose without the old bind mount.

## Smoke test after adding a drive

```bash
# Bind mount is live
docker exec -it radarr ls /data/extra-0/movies

# Sonarr/Radarr see the root folder
curl -s -H "X-Api-Key: $(cat ~/arrstack/config/radarr/api_key.txt)" \
  http://localhost:7878/api/v3/rootfolder | jq

# Jellyfin library includes the path
curl -s -H "X-Emby-Token: $(cat ~/arrstack/config/jellyfin/data/api_key.txt)" \
  http://localhost:8096/Library/VirtualFolders | jq '.[] | {Name, Locations}'
```

If all three return the `extra-0` path, you are done.

## Next steps

- [03. Daily use](03-daily-use.md): hardlink behavior across the new drive.
- [08. Backup and restore](08-backup-restore.md): add the new mount point to your rsync target.
- [09. Updating](09-updating.md): bind mounts survive updates, but it's worth verifying after the next `arrstack update`.
