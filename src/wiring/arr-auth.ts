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

// Shared by install and update so both know every arr app whose login is
// seeded through the API. Ports match the catalog's adminPort values.
export const ARR_AUTH_TARGETS = [
  { id: "prowlarr", port: 9696, apiVersion: "v1" },
  { id: "sonarr", port: 8989, apiVersion: "v3" },
  { id: "radarr", port: 7878, apiVersion: "v3" },
] as const;

export type ArrAuthTarget = (typeof ARR_AUTH_TARGETS)[number];

async function readBody(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 400); } catch { return ""; }
}

export type SeedArrAdminResult = "seeded" | "exists";

export async function seedArrAdmin(opts: ArrAuthOptions): Promise<SeedArrAdminResult> {
  const hostUrl = `${opts.baseUrl}/api/${opts.apiVersion}/config/host`;

  const getRes = await fetchWithRetry(hostUrl, {
    headers: { "X-Api-Key": opts.apiKey },
  });
  if (!getRes.ok) {
    throw new Error(`GET ${hostUrl} failed: HTTP ${getRes.status}\n${await readBody(getRes)}`);
  }
  const current = (await getRes.json()) as Record<string, unknown>;

  // Any existing user wins. Do not overwrite a username/password the user
  // changed in the UI, even when it differs from the installer default. Only a
  // genuinely unseeded instance (the state left behind when an install aborts
  // before the wiring steps) gets credentials written.
  if (current.username && current.password) {
    return "exists";
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
  return "seeded";
}
