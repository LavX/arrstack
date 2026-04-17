import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import { StateSchema, type State } from "./schema.js";

const STATE_FILE = "state.json";

export function readState(installDir: string): State | null {
  const statePath = join(installDir, STATE_FILE);
  if (!existsSync(statePath)) {
    return null;
  }
  const raw = readFileSync(statePath, "utf-8");
  const data = JSON.parse(raw);
  return StateSchema.parse(data);
}

export function writeState(installDir: string, state: State): void {
  const statePath = join(installDir, STATE_FILE);
  const tmpPath = `${statePath}.tmp`;
  const serialized = JSON.stringify(state, null, 2);
  writeFileSync(tmpPath, serialized, { mode: 0o600 });
  renameSync(tmpPath, statePath);
}
