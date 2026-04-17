import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { showPassword } from "../../src/usecase/show-password.js";
import { runDoctor } from "../../src/usecase/doctor.js";

test("showPassword reads admin.txt from install dir", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arrstack-test-"));
  const content = "username: admin\npassword: hunter2\ngenerated: 2026-01-01T00:00:00.000Z\n";
  writeFileSync(join(dir, "admin.txt"), content);

  // Capture stdout
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: any) => {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  };

  try {
    await showPassword(dir);
  } finally {
    process.stdout.write = originalWrite;
  }

  const output = chunks.join("");
  expect(output).toContain("username: admin");
  expect(output).toContain("password: hunter2");
});

test("showPassword prints message when admin.txt is missing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arrstack-test-"));

  const lines: string[] = [];
  const origLog = console.log;
  console.log = (...args: any[]) => lines.push(args.join(" "));

  try {
    await showPassword(dir);
  } finally {
    console.log = origLog;
  }

  expect(lines.join("\n")).toContain("No admin.txt found");
});

test("runDoctor throws when no state exists", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arrstack-test-"));

  await expect(runDoctor(dir)).rejects.toThrow("No state.json found");
});
