import { test, expect } from "bun:test";
import { spawnSync } from "bun";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repoRoot, "src", "cli.ts");

function runCli(...args: string[]) {
  const result = spawnSync(["bun", "run", cliPath, ...args], {
    cwd: repoRoot,
  });
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}

test("--version prints a version number", () => {
  const { stdout } = runCli("--version");
  expect(stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
});

test("--help includes arrstack", () => {
  const { stdout } = runCli("--help");
  expect(stdout).toContain("arrstack");
});

test("--help lists all subcommands", () => {
  const { stdout } = runCli("--help");
  expect(stdout).toContain("install");
  expect(stdout).toContain("doctor");
  expect(stdout).toContain("update");
  expect(stdout).toContain("show-password");
  expect(stdout).toContain("uninstall");
  expect(stdout).toContain("logs");
});
