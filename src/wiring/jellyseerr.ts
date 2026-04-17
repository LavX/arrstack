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

export async function linkJellyseerr(
  jellyfinUser: string,
  jellyfinPass: string,
  base = "http://localhost:5055"
): Promise<void> {
  await waitForJellyseerrReady(base);
  const res = await withRetry(() =>
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
        // MediaServerType.JELLYFIN from seerr-team/seerr's TS enum (PLEX=1,
        // JELLYFIN=2, EMBY=3). The route rejects the bootstrap with
        // NO_ADMIN_USER when this field is missing or not jellyfin/emby.
        serverType: 2,
        email: jellyfinUser,
      }),
    })
  );

  if (!res.ok) {
    let body = "";
    try { body = (await res.text()).slice(0, 2000); } catch { /* ignore */ }
    throw new Error(`Jellyseerr auth failed: HTTP ${res.status}\n${body}`);
  }
}
