import { withRetry, fetchWithRetry } from "../lib/retry.js";

interface VirtualFolder {
  Name: string;
  Locations: string[];
}

async function readBody(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 2000); } catch { return ""; }
}

// Jellyfin's /health returns 200 before the default user record is created
// internally, so the first POST /Startup/User can 500. Poll /Startup/User (GET)
// until it returns 200, which is Jellyfin's signal that the startup API is ready.
// Returns the current user record so a resumed install can detect a user that
// was created by an earlier attempt and skip the POST (Jellyfin answers 403
// once the first user exists).
async function waitForJellyfinStartupReady(
  base: string,
  timeoutMs = 60_000,
): Promise<{ Name?: string } | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${base}/Startup/User`);
      if (r.ok) {
        return (await r.json().catch(() => null)) as { Name?: string } | null;
      }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

async function isStartupComplete(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/System/Info/Public`);
    if (!res.ok) return false;
    const info = (await res.json()) as { StartupWizardCompleted?: boolean };
    return info.StartupWizardCompleted === true;
  } catch {
    return false;
  }
}

interface AuthResult {
  token: string;
  authHeader: string;
  userId: string;
  policy: Record<string, unknown>;
}

async function authenticate(
  base: string,
  adminUser: string,
  adminPass: string,
): Promise<AuthResult> {
  // Jellyfin 10.11+ parses the standard Authorization header. 12.x disables
  // the legacy X-Emby-Authorization fallback by default, and without Client /
  // Device / DeviceId / Version in the header AuthenticateByName returns 400
  // ("Value cannot be null. Parameter 'request.App'").
  const authHeader =
    'MediaBrowser Client="arrstack", Device="installer", DeviceId="arrstack", Version="1.0.0"';
  const authRes = await withRetry(() =>
    fetch(`${base}/Users/AuthenticateByName`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        // Older Jellyfin builds only read the legacy header. 10.11+ prefer
        // Authorization, and 12.x ignores this when legacy auth is disabled.
        "X-Emby-Authorization": authHeader,
      },
      body: JSON.stringify({ Username: adminUser, Pw: adminPass }),
    }),
  );
  if (!authRes.ok) {
    throw new Error(`AuthenticateByName failed: HTTP ${authRes.status}\n${await readBody(authRes)}`);
  }
  const authData = (await authRes.json()) as {
    AccessToken: string;
    User: { Id: string; Policy: Record<string, unknown> };
  };
  return {
    token: authData.AccessToken,
    authHeader,
    userId: authData.User.Id,
    policy: authData.User.Policy,
  };
}

// Some Jellyfin 10.11 setups leave the Startup-created user without the
// IsAdministrator flag, which breaks Jellyseerr bootstrap ("Failed login
// attempt from user without admin permissions"). Promote explicitly.
async function ensureAdmin(
  base: string,
  auth: AuthResult,
  authedHeaders: Record<string, string>,
): Promise<void> {
  if (auth.policy.IsAdministrator === true) return;
  const nextPolicy = { ...auth.policy, IsAdministrator: true };
  const res = await fetch(`${base}/Users/${auth.userId}/Policy`, {
    method: "POST",
    headers: authedHeaders,
    body: JSON.stringify(nextPolicy),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to grant admin to "${auth.userId}": HTTP ${res.status}\n${await readBody(res)}`,
    );
  }
}

export async function setupJellyfin(
  adminUser: string,
  adminPass: string,
  libraries: Array<{ name: string; type: string; paths: string[] }>,
  base = "http://localhost:8096",
): Promise<void> {
  // Idempotent: on a reconfigure (e.g. adding a new drive) Jellyfin is already
  // set up, so skip Startup/* and go straight to authenticating with the
  // stored creds. On first install those endpoints run normally.
  const startupDone = await isStartupComplete(base);

  if (!startupDone) {
    const configRes = await fetchWithRetry(`${base}/Startup/Configuration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        UICulture: "en-US",
        MetadataCountryCode: "US",
        PreferredMetadataLanguage: "en",
      }),
    });
    if (!configRes.ok) {
      throw new Error(`Startup/Configuration failed: HTTP ${configRes.status}\n${await readBody(configRes)}`);
    }

    const startupUser = await waitForJellyfinStartupReady(base);

    // A previous attempt may have created the first user before failing later
    // (or the user answered part of the startup wizard). POSTing /Startup/User
    // again returns 403, so only create the user when none exists.
    if (!startupUser?.Name) {
      const userRes = await fetchWithRetry(`${base}/Startup/User`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Name: adminUser, Password: adminPass }),
      });
      if (!userRes.ok) {
        throw new Error(`Startup/User failed: HTTP ${userRes.status}\n${await readBody(userRes)}`);
      }
    }
  }

  // Authenticate with the (now-existing) admin user
  const auth = await authenticate(base, adminUser, adminPass);
  const tokenHeader = `${auth.authHeader}, Token="${auth.token}"`;
  const authedHeaders = {
    "Content-Type": "application/json",
    Authorization: tokenHeader,
    "X-Emby-Authorization": tokenHeader,
  };

  await ensureAdmin(base, auth, authedHeaders);

  // Fetch existing libraries so we can decide create-vs-add-path per library.
  const existingRes = await fetch(`${base}/Library/VirtualFolders`, { headers: authedHeaders });
  const existing: VirtualFolder[] = existingRes.ok ? await existingRes.json() : [];
  const existingByName = new Map(existing.map((v) => [v.Name, new Set(v.Locations ?? [])]));

  for (const lib of libraries) {
    const current = existingByName.get(lib.name);
    if (!current) {
      // New library: POST /Library/VirtualFolders
      const url = `${base}/Library/VirtualFolders?name=${encodeURIComponent(lib.name)}&collectionType=${encodeURIComponent(lib.type)}&refreshLibrary=true`;
      const libRes = await withRetry(() =>
        fetch(url, {
          method: "POST",
          headers: authedHeaders,
          body: JSON.stringify({
            LibraryOptions: { PathInfos: lib.paths.map((p) => ({ Path: p })) },
          }),
        }),
      );
      if (!libRes.ok) {
        throw new Error(
          `Failed to create library "${lib.name}": HTTP ${libRes.status}\n${await readBody(libRes)}`,
        );
      }
    } else {
      // Existing library: add any paths that aren't already present (e.g. a new drive).
      for (const path of lib.paths) {
        if (current.has(path)) continue;
        const addRes = await withRetry(() =>
          fetch(`${base}/Library/VirtualFolders/Paths?refreshLibrary=true`, {
            method: "POST",
            headers: authedHeaders,
            body: JSON.stringify({
              Name: lib.name,
              Path: path,
              PathInfo: { Path: path },
            }),
          }),
        );
        if (!addRes.ok) {
          throw new Error(
            `Failed to add path "${path}" to library "${lib.name}": HTTP ${addRes.status}\n${await readBody(addRes)}`,
          );
        }
      }
    }
  }

  // Mark wizard complete (no-op if already done)
  if (!startupDone) {
    const completeRes = await withRetry(() =>
      fetch(`${base}/Startup/Complete`, { method: "POST", headers: authedHeaders }),
    );
    if (!completeRes.ok) {
      throw new Error(`Startup/Complete failed: HTTP ${completeRes.status}\n${await readBody(completeRes)}`);
    }
  }
}
