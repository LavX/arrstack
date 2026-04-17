import { exec } from "../lib/exec.js";

export async function isDockerInstalled(): Promise<boolean> {
  const result = await exec("docker --version", { timeoutMs: 5000 });
  return result.ok;
}

export async function isDockerRunning(): Promise<boolean> {
  const result = await exec("docker info", { timeoutMs: 10000 });
  return result.ok;
}

export async function isComposeV2(): Promise<boolean> {
  const result = await exec("docker compose version", { timeoutMs: 5000 });
  return result.ok;
}

export async function getDockerVersion(): Promise<string> {
  const result = await exec("docker --version", { timeoutMs: 5000 });
  if (!result.ok) return "";
  return result.stdout.trim();
}
