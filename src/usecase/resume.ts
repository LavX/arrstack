import { readState, readAdminCredentials } from "../state/store.js";
import { runInstall, type InstallResult, type StepUpdate } from "./install.js";
import { VERSION } from "../version.js";

export type RunInstallFn = typeof runInstall;

export interface RunResumeOptions {
  onStep?: (update: StepUpdate) => void;
  // Injectable for tests. Production uses runInstall.
  runInstallFn?: RunInstallFn;
}

function printStep(update: StepUpdate): void {
  if (update.status === "running") {
    process.stdout.write(`  ${update.step}... `);
  } else if (update.status === "done") {
    const seconds = ((update.durationMs ?? 0) / 1000).toFixed(1);
    console.log(`ok (${seconds}s)`);
  } else if (update.status === "failed") {
    console.log(`FAILED\n    ${update.message ?? "unknown error"}`);
  }
}

// Non-interactive `arrstack install --resume --yes`. Reads the saved state and
// the existing admin password, then reruns the full install pipeline: render,
// pull, up, health gate, and every wiring step (arr logins, Jellyfin,
// Jellyseerr, qBittorrent, etc). This is the scriptable recovery path for an
// install that aborted before wiring, and it never rotates the admin password.
export async function runResume(
  installDir: string,
  opts: RunResumeOptions = {},
): Promise<InstallResult> {
  const state = readState(installDir);
  if (!state) {
    throw new Error(`No state.json found in ${installDir}. Run 'arrstack install' first.`);
  }

  const creds = readAdminCredentials(installDir);
  if (!creds) {
    throw new Error(
      `No readable admin.txt found in ${installDir}. ` +
        `A previous install may have failed before writing it. Run 'arrstack install --fresh'.`,
    );
  }

  const install = opts.runInstallFn ?? runInstall;
  return install(
    { ...state, install_dir: installDir, installer_version: VERSION },
    creds.password,
    opts.onStep ?? printStep,
  );
}
