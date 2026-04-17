import { withRetry } from "../lib/retry.js";

// Jellyseerr's /api/v1/status returns 200 almost immediately, but the admin
// bootstrap (auth/jellyfin) fails silently until after the DB migrations and
// Discover Slider seeding finish. Wait until GET /api/v1/settings/public
// returns a body that acknowledges no admin exists yet, which signals the
// bootstrap endpoint is really ready.
async function waitForJellyseerrReady(base: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${base}/api/v1/settings/public`);
      if (r.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

interface Library { id: string; name: string; enabled: boolean; type: string }

async function readBody(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 500); } catch { return ""; }
}

export async function linkJellyseerr(
  jellyfinUser: string,
  jellyfinPass: string,
  base = "http://localhost:5055"
): Promise<void> {
  await waitForJellyseerrReady(base);

  // 1. Bootstrap: create the admin + store the Jellyfin connection.
  const bootstrap = await withRetry(() =>
    fetch(`${base}/api/v1/auth/jellyfin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: jellyfinUser,
        password: jellyfinPass,
        hostname: "jellyfin",
        port: 8096,
        useSsl: false,
        urlBase: "",
        // MediaServerType enum (PLEX=1, JELLYFIN=2, EMBY=3). Without this the
        // endpoint returns HTTP 500 {"message":"NO_ADMIN_USER"}.
        serverType: 2,
        email: jellyfinUser,
      }),
    })
  );
  if (!bootstrap.ok) {
    throw new Error(`Jellyseerr auth failed: HTTP ${bootstrap.status}\n${await readBody(bootstrap)}`);
  }

  // bootstrap also sets a session cookie; reuse it for the remaining config.
  const cookie =
    (bootstrap.headers.get("set-cookie") ?? "").match(/connect\.sid=[^;]+/)?.[0] ?? "";
  const authedHeaders = { "Content-Type": "application/json", Cookie: cookie };

  // 2. Sync the Jellyfin library list so Jellyseerr knows what exists.
  const syncRes = await withRetry(() =>
    fetch(`${base}/api/v1/settings/jellyfin/library?sync=true`, { headers: authedHeaders }),
  );
  if (!syncRes.ok) {
    throw new Error(`Jellyseerr library sync failed: HTTP ${syncRes.status}\n${await readBody(syncRes)}`);
  }
  const libs = (await syncRes.json()) as Library[];

  // 3. Enable every library (Movies, TV Shows, Music). Jellyseerr's library
  // flag is what the /setup wizard toggles at step 3 — without it, requests
  // can't be matched against media.
  if (libs.length > 0) {
    const enableIds = libs.map((l) => l.id).join(",");
    const enableRes = await withRetry(() =>
      fetch(`${base}/api/v1/settings/jellyfin/library?enable=${enableIds}`, {
        headers: authedHeaders,
      }),
    );
    if (!enableRes.ok) {
      throw new Error(`Jellyseerr enable libraries failed: HTTP ${enableRes.status}\n${await readBody(enableRes)}`);
    }

    // Kick off the one-time full media scan in the background.
    await fetch(`${base}/api/v1/settings/jellyfin/sync`, {
      method: "POST",
      headers: authedHeaders,
      body: "{}",
    }).catch(() => { /* scan is best-effort */ });
  }

  // 4. Mark Jellyseerr as initialized so the /setup wizard is replaced by /.
  const initRes = await withRetry(() =>
    fetch(`${base}/api/v1/settings/initialize`, { method: "POST", headers: authedHeaders }),
  );
  if (!initRes.ok) {
    throw new Error(`Jellyseerr initialize failed: HTTP ${initRes.status}\n${await readBody(initRes)}`);
  }
}
