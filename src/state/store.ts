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

/**
 * True when admin.txt exists but cannot be read. This happens when a prior
 * `sudo arrstack install` left it owned by root and a later non-sudo run hits
 * EACCES. The installer must NOT treat that as "no password" and silently
 * generate a new one: the qBittorrent container from the earlier run still
 * holds the old password, so a rotate rewrites qBittorrent.conf with a hash the
 * running container never sees and the user is locked out. Callers should stop
 * with an actionable message instead. A genuinely absent file returns false
 * (that is a normal fresh install).
 */
export function adminTxtUnreadable(installDir: string): boolean {
  const p = join(installDir, "admin.txt");
  if (!existsSync(p)) return false;
  try {
    readFileSync(p, "utf-8");
    return false;
  } catch {
    return true;
  }
}

// The actionable message to print when admin.txt can't be read, or null when
// it's fine to proceed. Kept here (not in cli.ts, which self-executes on import)
// so the guard's decision is unit-testable. cli.ts prints this and exits.
export function adminTxtGuardMessage(installDir: string): string | null {
  if (!adminTxtUnreadable(installDir)) return null;
  const p = join(installDir, "admin.txt");
  return (
    `Cannot read ${p}. It looks like a previous 'sudo arrstack install' left it owned by root.\n` +
    `Fix ownership and re-run as your normal user (not sudo):\n` +
    `  sudo chown $(id -u):$(id -g) ${p}`
  );
}

export interface AdminCredentials {
  username: string;
  password: string;
}

/**
 * Read the credentials the installer wrote at install time. Returns null when
 * admin.txt is absent, unreadable, or incomplete, so callers can skip recovery
 * work instead of crashing or rotating the password.
 */
export function readAdminCredentials(installDir: string): AdminCredentials | null {
  const p = join(installDir, "admin.txt");
  try {
    const text = readFileSync(p, "utf-8");
    const username = text.match(/^username:\s*(.+)$/m)?.[1]?.trim();
    const password = text.match(/^password:\s*(.+)$/m)?.[1]?.trim();
    if (!username || !password) return null;
    return { username, password };
  } catch {
    return null;
  }
}

export function writeState(installDir: string, state: State): void {
  const statePath = join(installDir, STATE_FILE);
  const tmpPath = `${statePath}.tmp`;
  const serialized = JSON.stringify(state, null, 2);
  writeFileSync(tmpPath, serialized, { mode: 0o600 });
  renameSync(tmpPath, statePath);
}
