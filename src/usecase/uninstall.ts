import { join } from "node:path";
import { readState } from "../state/store.js";
import { exec } from "../lib/exec.js";
import { purgeInstallDir } from "./cleanup.js";

export async function runUninstall(installDir: string, purge: boolean): Promise<void> {
  const state = readState(installDir);
  if (!state) {
    throw new Error(`No state.json found in ${installDir}. Nothing to uninstall.`);
  }

  const composeFile = join(installDir, "docker-compose.yml");

  console.log("Stopping and removing containers...");
  const down = await exec(`docker compose -f "${composeFile}" down`, { timeoutMs: 120_000 });
  if (!down.ok) {
    console.warn(`docker compose down returned an error: ${down.stderr}`);
  }

  if (purge) {
    const removed = await purgeInstallDir(installDir);
    for (const path of removed) {
      console.log(`Removed: ${path}`);
    }
    console.log(`Preserved: ${state.storage_root} (media data not deleted)`);
  } else {
    console.log(`Containers removed. Config and media data preserved.`);
    console.log(`  Config: ${join(installDir, "config")}`);
    console.log(`  Media:  ${state.storage_root}`);
    console.log(`Re-run with --purge to also remove config files.`);
  }
}
