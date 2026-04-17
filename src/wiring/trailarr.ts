import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchWithRetry, withRetry } from "../lib/retry.js";

// Trailarr generates a random API key at container first-start and writes it
// to /config/.env inside the container, which maps to installDir/config/
// trailarr/.env on the host. We read it from there; all Trailarr API calls
// authenticate with either the X-API-Key header or ?apikey= query.
//
// Out of the box Trailarr has:
//   - default login admin / trailarr (yes, literally "trailarr")
//   - no Sonarr/Radarr connections registered
//   - monitor=true but nothing to monitor
//
// We update the login to the installer-generated admin credentials and add
// both arr connections so the scheduler starts fetching trailers.

export interface TrailarrOptions {
  installDir: string;
  adminUser: string;
  adminPass: string;
  sonarrApiKey: string;
  radarrApiKey: string;
  base?: string;
}

async function readBody(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 400); } catch { return ""; }
}

function readApiKey(installDir: string): string {
  const envPath = join(installDir, "config", "trailarr", ".env");
  const contents = readFileSync(envPath, "utf-8");
  const match = contents.match(/^API_KEY=['"]?([^'"\n]+)['"]?$/m);
  if (!match) {
    throw new Error(
      `Trailarr API_KEY not found in ${envPath}. The container may not have ` +
      `finished its first-boot entrypoint yet.`,
    );
  }
  return match[1];
}

export async function configureTrailarr(opts: TrailarrOptions): Promise<void> {
  const base = opts.base ?? "http://localhost:7889";
  const apiKey = readApiKey(opts.installDir);
  const headers = { "X-API-Key": apiKey, "Content-Type": "application/json" };

  // 1. Replace the default login (admin / "trailarr") with the installer's
  // admin credentials. Trailarr requires current_password — the container's
  // baked-in default is the literal string "trailarr".
  const loginRes = await fetchWithRetry(`${base}/api/v1/settings/updatelogin`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      current_password: "trailarr",
      new_username: opts.adminUser,
      new_password: opts.adminPass,
    }),
  });
  // 200 = changed, 400 = already set to our creds (idempotent reconfigure).
  if (!loginRes.ok && loginRes.status !== 400) {
    throw new Error(
      `Trailarr login update failed: HTTP ${loginRes.status}\n${await readBody(loginRes)}`,
    );
  }

  // 2. List existing connections so we're idempotent.
  const listRes = await withRetry(() =>
    fetch(`${base}/api/v1/connections/`, { headers }),
  );
  if (!listRes.ok) {
    throw new Error(`Trailarr list connections failed: HTTP ${listRes.status}`);
  }
  const existing = (await listRes.json()) as Array<{ name: string }>;
  const existingNames = new Set(existing.map((c) => c.name));

  for (const conn of [
    {
      name: "Sonarr",
      arr_type: "sonarr",
      url: "http://sonarr:8989",
      api_key: opts.sonarrApiKey,
      monitor: "new",
      path_mappings: [],
    },
    {
      name: "Radarr",
      arr_type: "radarr",
      url: "http://radarr:7878",
      api_key: opts.radarrApiKey,
      monitor: "new",
      path_mappings: [],
    },
  ]) {
    if (existingNames.has(conn.name)) continue;
    const res = await withRetry(() =>
      fetch(`${base}/api/v1/connections/`, {
        method: "POST",
        headers,
        body: JSON.stringify(conn),
      }),
    );
    if (res.status !== 201 && res.status !== 200) {
      throw new Error(
        `Trailarr ${conn.name} connection failed: HTTP ${res.status}\n${await readBody(res)}`,
      );
    }
  }
}
