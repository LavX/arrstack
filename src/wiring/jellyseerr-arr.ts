import { withRetry } from "../lib/retry.js";

// Registers Sonarr and Radarr in Jellyseerr so it can dispatch requests.
// Jellyseerr's auth session is cookie-based; we log in with the admin creds
// and reuse the cookie for the subsequent settings PUTs.

export interface JellyseerrArrOptions {
  adminUser: string;
  adminPass: string;
  sonarrApiKey: string;
  radarrApiKey: string;
  base?: string; // Jellyseerr base URL
}

async function readBody(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 500); } catch { return ""; }
}

// Post-bootstrap login: admin exists, Jellyfin is already linked. Sending
// `hostname` again returns 500 "Jellyfin hostname already configured", so
// only send username/password here.
async function loginAsAdmin(
  base: string,
  user: string,
  pass: string,
): Promise<string> {
  const res = await withRetry(() =>
    fetch(`${base}/api/v1/auth/jellyfin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
    }),
  );
  if (!res.ok) {
    throw new Error(`Jellyseerr login failed: HTTP ${res.status}\n${await readBody(res)}`);
  }
  const cookie = res.headers.get("set-cookie") ?? "";
  const match = cookie.match(/connect\.sid=[^;]+/);
  if (!match) throw new Error("Jellyseerr login succeeded but no session cookie was set");
  return match[0];
}

export async function linkJellyseerrToArrs(
  opts: JellyseerrArrOptions,
): Promise<void> {
  const base = opts.base ?? "http://localhost:5055";
  const cookie = await loginAsAdmin(base, opts.adminUser, opts.adminPass);
  const headers = { "Content-Type": "application/json", Cookie: cookie };

  // Check what's already configured so we're idempotent on reconfigure.
  const existingSonarr = await fetch(`${base}/api/v1/settings/sonarr`, { headers });
  const existingRadarr = await fetch(`${base}/api/v1/settings/radarr`, { headers });
  const sonarrList = existingSonarr.ok ? ((await existingSonarr.json()) as Array<{ name: string }>) : [];
  const radarrList = existingRadarr.ok ? ((await existingRadarr.json()) as Array<{ name: string }>) : [];

  if (!sonarrList.some((s) => s.name === "Sonarr")) {
    const body = {
      name: "Sonarr",
      hostname: "sonarr",
      port: 8989,
      apiKey: opts.sonarrApiKey,
      useSsl: false,
      baseUrl: "",
      activeProfileId: 1,
      activeProfileName: "Any",
      activeDirectory: "/data/media/tv",
      is4k: false,
      isDefault: true,
      enableSeasonFolders: true,
      syncEnabled: true,
    };
    const res = await withRetry(() =>
      fetch(`${base}/api/v1/settings/sonarr`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    );
    if (!res.ok) {
      throw new Error(`Jellyseerr Sonarr link failed: HTTP ${res.status}\n${await readBody(res)}`);
    }
  }

  if (!radarrList.some((r) => r.name === "Radarr")) {
    const body = {
      name: "Radarr",
      hostname: "radarr",
      port: 7878,
      apiKey: opts.radarrApiKey,
      useSsl: false,
      baseUrl: "",
      activeProfileId: 1,
      activeProfileName: "Any",
      activeDirectory: "/data/media/movies",
      minimumAvailability: "released",
      is4k: false,
      isDefault: true,
      syncEnabled: true,
    };
    const res = await withRetry(() =>
      fetch(`${base}/api/v1/settings/radarr`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    );
    if (!res.ok) {
      throw new Error(`Jellyseerr Radarr link failed: HTTP ${res.status}\n${await readBody(res)}`);
    }
  }
}
