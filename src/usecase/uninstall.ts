import { join } from "node:path";
import { rmSync, existsSync } from "node:fs";
import { readState } from "../state/store.js";
import { exec } from "../lib/exec.js";

export async function runUninstall(installDir: string, purge: boolean): Promise<void> {
  const state = readState(installDir);
  if (!state) {
    throw new Error(`No state.json found in ${installDir}. Nothing to uninstall.`);
  }

  const composeFile = join(installDir, "docker-compose.yml");

  console.log("Stopping and removing containers...");
  const down = await exec(`docker compose -f "${composeFile}" down`, { timeoutMs: 120_000 });
  if (!down.ok) {
    // Log the warning but continue — containers may already be stopped
    console.warn(`docker compose down returned an error: ${down.stderr}`);
  }

  if (purge) {
    const configDir = join(installDir, "config");
    if (existsSync(configDir)) {
      rmSync(configDir, { recursive: true, force: true });
      console.log(`Removed: ${configDir}`);
    }
    console.log(`Preserved: ${state.storage_root} (media data not deleted)`);
  } else {
    console.log(`Containers removed. Config and media data preserved.`);
    console.log(`  Config: ${join(installDir, "config")}`);
    console.log(`  Media:  ${state.storage_root}`);
    console.log(`Re-run with --purge to also remove config files.`);
  }
}
