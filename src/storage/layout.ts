import { mkdirSync, chownSync } from "fs";
import { join } from "path";

const DIRS = [
  "torrents/tv", "torrents/movies", "torrents/music", "torrents/books",
  "media/tv", "media/movies", "media/music",
];

export function createStorageLayout(root: string, uid: number, gid: number): void {
  for (const dir of DIRS) {
    const full = join(root, dir);
    mkdirSync(full, { recursive: true });
    try { chownSync(full, uid, gid); } catch { /* non-root, skip chown */ }
  }
}
