import { spawn, spawnSync } from "bun";

export interface ExecOpts {
  timeoutMs?: number;
}

export type ExecResult =
  | { ok: true; stdout: string; stderr: string }
  | { ok: false; stderr: string; code: number | null };

// Pass an argv array (preferred) to spawn directly with no shell, so user-controlled
// paths/arguments can never be interpreted as shell metacharacters. Pass a string only
// when a shell pipeline (pipes, globs, redirects) is actually needed — callers are
// responsible for ensuring no user-controlled data is interpolated.
export async function exec(cmdOrArgv: string | string[], opts: ExecOpts = {}): Promise<ExecResult> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const argv = Array.isArray(cmdOrArgv) ? cmdOrArgv : ["sh", "-c", cmdOrArgv];

  const proc = spawn(argv, { stdout: "pipe", stderr: "pipe" });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);

  const [exitCode, stdoutBuf, stderrBuf] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  clearTimeout(timer);

  if (timedOut) {
    return { ok: false, stderr: `timed out after ${timeoutMs}ms`, code: null };
  }

  if (exitCode === 0) {
    return { ok: true, stdout: stdoutBuf.trimEnd(), stderr: stderrBuf.trimEnd() };
  }

  return { ok: false, stderr: stderrBuf.trimEnd(), code: exitCode };
}

export function execSync_(cmdOrArgv: string | string[]): string {
  const argv = Array.isArray(cmdOrArgv) ? cmdOrArgv : ["sh", "-c", cmdOrArgv];
  const result = spawnSync(argv, { stdout: "pipe", stderr: "pipe" });
  return result.stdout.toString().trim();
}
