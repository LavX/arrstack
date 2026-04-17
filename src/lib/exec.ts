import { spawn, spawnSync } from "bun";

export interface ExecOpts {
  timeoutMs?: number;
}

export type ExecResult =
  | { ok: true; stdout: string; stderr: string }
  | { ok: false; stderr: string; code: number | null };

export async function exec(cmd: string, opts: ExecOpts = {}): Promise<ExecResult> {
  const timeoutMs = opts.timeoutMs ?? 120_000;

  const proc = spawn(["sh", "-c", cmd], {
    stdout: "pipe",
    stderr: "pipe",
  });

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

export function execSync_(cmd: string): string {
  const result = spawnSync(["sh", "-c", cmd], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.stdout.toString().trim();
}
