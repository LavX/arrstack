import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { purgeInstallDir } from "../../src/usecase/cleanup.js";

test("purgeInstallDir removes installer-generated files and preserves sibling storage", async () => {
  const root = mkdtempSync(join(tmpdir(), "arrstack-purge-"));
  const installDir = join(root, "arrstack");
  const storageRoot = join(root, "data");
  mkdirSync(installDir, { recursive: true });
  mkdirSync(storageRoot, { recursive: true });

  writeFileSync(join(installDir, "state.json"), "{}");
  writeFileSync(join(installDir, "admin.txt"), "user\npass\n");
  writeFileSync(join(installDir, "docker-compose.yml"), "version: '3'\n");
  writeFileSync(join(installDir, ".env"), "FOO=bar\n");
  writeFileSync(join(installDir, "Caddyfile"), "localhost {}\n");
  writeFileSync(join(installDir, "FIRST-RUN.md"), "# first run\n");
  writeFileSync(join(installDir, "install.log"), "log\n");
  mkdirSync(join(installDir, "config", "sonarr"), { recursive: true });
  writeFileSync(join(installDir, "config", "sonarr", "config.xml"), "<Config/>");
  mkdirSync(join(installDir, "caddy"), { recursive: true });
  writeFileSync(join(installDir, "caddy", "Dockerfile"), "FROM caddy\n");

  writeFileSync(join(storageRoot, "movie.mkv"), "binary-ish");
  mkdirSync(join(storageRoot, "media", "tv"), { recursive: true });
  writeFileSync(join(storageRoot, "media", "tv", "episode.mkv"), "binary-ish");

  await purgeInstallDir(installDir);

  for (const entry of [
    "state.json",
    "admin.txt",
    "docker-compose.yml",
    ".env",
    "Caddyfile",
    "FIRST-RUN.md",
    "install.log",
    "config",
    "caddy",
  ]) {
    expect(existsSync(join(installDir, entry))).toBe(false);
  }

  expect(existsSync(storageRoot)).toBe(true);
  expect(existsSync(join(storageRoot, "movie.mkv"))).toBe(true);
  expect(existsSync(join(storageRoot, "media", "tv", "episode.mkv"))).toBe(true);
});

test("purgeInstallDir is idempotent when files are already absent", async () => {
  const installDir = mkdtempSync(join(tmpdir(), "arrstack-purge-empty-"));
  await expect(purgeInstallDir(installDir)).resolves.toBeDefined();
  await expect(purgeInstallDir(installDir)).resolves.toBeDefined();
  expect(existsSync(installDir)).toBe(true);
});
