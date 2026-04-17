import { join } from "node:path";
import { readState } from "../state/store.js";
import { exec } from "../lib/exec.js";

export async function runUpdate(installDir: string): Promise<void> {
  const state = readState(installDir);
  if (!state) {
    throw new Error(`No state.json found in ${installDir}. Run 'arrstack install' first.`);
  }

  const composeFile = join(installDir, "docker-compose.yml");

  console.log("Pulling latest images...");
  const pull = await exec(`docker compose -f "${composeFile}" pull`, { timeoutMs: 600_000 });
  if (!pull.ok) {
    throw new Error(`docker compose pull failed: ${pull.stderr}`);
  }

  console.log("Restarting services...");
  const up = await exec(`docker compose -f "${composeFile}" up -d`, { timeoutMs: 120_000 });
  if (!up.ok) {
    throw new Error(`docker compose up failed: ${up.stderr}`);
  }

  console.log("Updated. Run 'arrstack doctor' to verify.");
}
