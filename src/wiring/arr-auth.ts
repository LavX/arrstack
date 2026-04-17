import { fetchWithRetry } from "../lib/retry.js";

// Sonarr / Radarr / Prowlarr v4 store users in SQLite, not config.xml, so we
// can't preseed credentials from the installer's config-pre-write step. Once
// the app is up we PUT /api/v{N}/config/host with username/password/
// passwordConfirmation filled in — this is the same call their setup wizard
// makes and it creates the first user.
//
// API version differs: Sonarr/Radarr use v3, Prowlarr uses v1.

export interface ArrAuthOptions {
  apiKey: string;
  username: string;
  password: string;
  baseUrl: string;
  apiVersion: "v1" | "v3";
}

async function readBody(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 400); } catch { return ""; }
}

export async function seedArrAdmin(opts: ArrAuthOptions): Promise<void> {
  const hostUrl = `${opts.baseUrl}/api/${opts.apiVersion}/config/host`;

  const getRes = await fetchWithRetry(hostUrl, {
    headers: { "X-Api-Key": opts.apiKey },
  });
  if (!getRes.ok) {
    throw new Error(`GET ${hostUrl} failed: HTTP ${getRes.status}\n${await readBody(getRes)}`);
  }
  const current = (await getRes.json()) as Record<string, unknown>;

  // If the admin user is already set, don't re-PUT — some arr versions reject
  // identical password updates as "Must match" validation noise on reconfigure.
  if (current.username === opts.username && current.password) {
    return;
  }

  const updated = {
    ...current,
    authenticationMethod: "forms",
    authenticationRequired: "enabled",
    username: opts.username,
    password: opts.password,
    passwordConfirmation: opts.password,
  };

  const putRes = await fetchWithRetry(hostUrl, {
    method: "PUT",
    headers: { "X-Api-Key": opts.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(updated),
  });
  // Sonarr/Radarr return 202 (Accepted — restart may be required for some
  // fields), Prowlarr returns 200 with the new body. Both are success.
  if (putRes.status !== 200 && putRes.status !== 202) {
    throw new Error(
      `PUT ${hostUrl} failed: HTTP ${putRes.status}\n${await readBody(putRes)}`,
    );
  }
}
