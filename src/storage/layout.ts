import { mkdirSync, chownSync } from "fs";
import { join } from "path";

const PRIMARY_DIRS = [
  "torrents/tv", "torrents/movies", "torrents/music", "torrents/books",
  "media/tv", "media/movies", "media/music",
];

// Subdirs created inside each extra (additional drive) path so Sonarr/Radarr
// root folders and Jellyfin library paths like /data/extra-0/tv resolve to
// real directories.
const EXTRA_DIRS = ["tv", "movies"];

function mkOrThrow(full: string, root: string): void {
  try {
    mkdirSync(full, { recursive: true });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "EACCES" || e.code === "EPERM") {
      throw new Error(
        `Cannot create ${full}: permission denied. ` +
        `Pick a path your user can write to (e.g. under $HOME), ` +
        `or run the installer with sudo if you want ${root}.`
      );
    }
    throw err;
  }
}

export function createStorageLayout(
  root: string,
  uid: number,
  gid: number,
  extraPaths: string[] = [],
): void {
  for (const dir of PRIMARY_DIRS) {
    const full = join(root, dir);
    mkOrThrow(full, root);
    try { chownSync(full, uid, gid); } catch { /* non-root, skip chown */ }
  }

  for (const extra of extraPaths) {
    for (const sub of EXTRA_DIRS) {
      const full = join(extra, sub);
      mkOrThrow(full, extra);
      try { chownSync(full, uid, gid); } catch { /* non-root, skip chown */ }
    }
  }
}
