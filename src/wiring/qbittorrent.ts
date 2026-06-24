import { withRetry } from "../lib/retry.js";

const CATEGORIES = [
  { name: "tv", savePath: "/data/torrents/tv" },
  { name: "movies", savePath: "/data/torrents/movies" },
  { name: "music", savePath: "/data/torrents/music" },
  { name: "books", savePath: "/data/torrents/books" },
] as const;

export async function configureQbit(
  user: string,
  pass: string,
  base = "http://localhost:8080"
): Promise<void> {
  // 1. Login and extract SID cookie
  const loginRes = await withRetry(() =>
    fetch(`${base}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: user, password: pass }).toString(),
    })
  );

  if (!loginRes.ok) {
    // qBittorrent returns 403 for both "wrong password" and "your IP is
    // banned after too many failures"; surface the body so the user can tell
    // them apart. The ban is in-memory and clears on `docker compose restart
    // qbittorrent`.
    const body = (await loginRes.text()).trim();
    const hint = body.toLowerCase().includes("banned")
      ? " — run `docker compose restart qbittorrent` to clear the in-memory IP ban, then re-run the installer"
      : "";
    throw new Error(`qBittorrent login failed: ${loginRes.status} ${body}${hint}`);
  }

  // qBittorrent 5.x returns 204 No Content (empty body) on a successful login;
  // older builds returned 200 with the body "Ok.". Wrong credentials still come
  // back with loginRes.ok true and the body "Fails.", so reject on that rather
  // than requiring an exact "Ok." (which 5.x never sends).
  const body = (await loginRes.text()).trim();
  if (body === "Fails.") {
    throw new Error("qBittorrent login failed: incorrect username or password");
  }

  // 2. Reuse the session cookie verbatim. qBittorrent 5.x renamed it from `SID`
  // to `QBT_SID_<port>` (e.g. QBT_SID_8080), so take the first name=value pair
  // from Set-Cookie instead of matching a hard-coded cookie name.
  const setCookie = loginRes.headers.get("set-cookie") ?? "";
  const cookieHeader = setCookie.split(";")[0]?.trim() ?? "";
  if (!/sid/i.test(cookieHeader)) {
    throw new Error("qBittorrent login did not return a session cookie");
  }

  // 3. Create categories
  for (const cat of CATEGORIES) {
    const catRes = await fetch(`${base}/api/v2/torrents/createCategory`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader,
      },
      body: new URLSearchParams({
        category: cat.name,
        savePath: cat.savePath,
      }).toString(),
    });
    // 409 means category already exists, which is fine
    if (!catRes.ok && catRes.status !== 409) {
      throw new Error(
        `qBittorrent createCategory "${cat.name}" failed: ${catRes.status}`
      );
    }
  }

  // 4. Apply TRaSH-recommended preferences
  const prefs = {
    save_path: "/data/torrents",
    temp_path_enabled: false,
    preallocate_all: false,
    max_ratio_enabled: false,
    max_seeding_time_enabled: false,
    utp_rate_limited: true,
  };

  const prefsRes = await fetch(`${base}/api/v2/app/setPreferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader,
    },
    body: new URLSearchParams({ json: JSON.stringify(prefs) }).toString(),
  });

  if (!prefsRes.ok) {
    throw new Error(
      `qBittorrent setPreferences failed: ${prefsRes.status}`
    );
  }
}
