import { test, expect } from "bun:test";
import { spawnSync } from "bun";

function runCli(...args: string[]) {
  const result = spawnSync(["bun", "run", "src/cli.ts", ...args], {
    cwd: "/home/lavx/arrstack-installer",
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
