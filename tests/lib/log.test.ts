import { test, expect, afterEach } from "bun:test";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createLogger } from "../../src/lib/log.js";

const tmpDir = join(tmpdir(), "arrstack-log-test-" + process.pid);

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

test("logger writes structured JSON lines", () => {
  mkdirSync(tmpDir, { recursive: true });
  const logFile = join(tmpDir, "install.log");

  const logger = createLogger(logFile);
  logger.info("preflight", "starting checks");
  logger.warn("preflight", "low disk space");

  const content = readFileSync(logFile, "utf8").trim();
  const lines = content.split("\n").map((l) => JSON.parse(l));

  expect(lines).toHaveLength(2);

  expect(lines[0]).toMatchObject({
    level: "info",
    step: "preflight",
    msg: "starting checks",
  });
  expect(typeof lines[0].ts).toBe("string");

  expect(lines[1]).toMatchObject({
    level: "warn",
    step: "preflight",
    msg: "low disk space",
  });
});

test("logger truncates file on creation", () => {
  mkdirSync(tmpDir, { recursive: true });
  const logFile = join(tmpDir, "install.log");

  const first = createLogger(logFile);
  first.info("setup", "first run");

  // Create a second logger for the same file - should truncate
  const second = createLogger(logFile);
  second.info("setup", "second run");

  const content = readFileSync(logFile, "utf8").trim();
  const lines = content.split("\n").map((l) => JSON.parse(l));

  expect(lines).toHaveLength(1);
  expect(lines[0].msg).toBe("second run");
});
