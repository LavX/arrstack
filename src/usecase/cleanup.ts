import { rm } from "node:fs/promises";
import { join } from "node:path";

const PURGE_ENTRIES = [
  "state.json",
  "admin.txt",
  "docker-compose.yml",
  ".env",
  "Caddyfile",
  "FIRST-RUN.md",
  "install.log",
  "config",
  "caddy",
] as const;

export async function purgeInstallDir(installDir: string): Promise<string[]> {
  const removed: string[] = [];
  for (const entry of PURGE_ENTRIES) {
    const target = join(installDir, entry);
    try {
      await rm(target, { recursive: true, force: true });
      removed.push(target);
    } catch {
      // force:true already swallows ENOENT; any other error (e.g. EACCES on a
      // single nested file) should not abort the purge of the remaining entries.
    }
  }
  return removed;
}
