import { exec } from "../lib/exec.js";

export async function checkPortFree(port: number): Promise<boolean> {
  // ss -lntu shows listening tcp/udp sockets; grep for :PORT followed by space or end
  const result = await exec(`ss -lntu 2>/dev/null | grep -E ':${port}( |$)'`, { timeoutMs: 5000 });
  // If grep found something the port is in use; exit 0 means match found
  return !result.ok;
}

export async function findFreePort(preferred: number, maxAttempts = 20): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = preferred + i;
    if (candidate > 65535) break;
    if (await checkPortFree(candidate)) return candidate;
  }
  return preferred; // fallback, will fail at compose up with a clear error
}

export async function getPortUser(port: number): Promise<string | null> {
  // ss -lntup includes process info
  const result = await exec(`ss -lntup 2>/dev/null | grep -E ':${port}( |$)'`, { timeoutMs: 5000 });
  if (!result.ok) return null;

  // Extract process name from users:(...) field
  const match = result.stdout.match(/users:\(\("([^"]+)"/);
  return match ? match[1] : result.stdout.trim() || null;
}
