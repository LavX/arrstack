import { fetch } from "undici";

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
  const loginRes = await fetch(`${base}/api/v2/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: user, password: pass }).toString(),
  });

  if (!loginRes.ok) {
    throw new Error(`qBittorrent login failed: ${loginRes.status}`);
  }

  const body = await loginRes.text();
  if (body.trim() !== "Ok.") {
    throw new Error(`qBittorrent login rejected: ${body.trim()}`);
  }

  // 2. Extract SID from Set-Cookie header
  const setCookie = loginRes.headers.get("set-cookie") ?? "";
  const sidMatch = setCookie.match(/SID=([^;]+)/);
  if (!sidMatch) {
    throw new Error("qBittorrent login did not return a SID cookie");
  }
  const sid = sidMatch[1];
  const cookieHeader = `SID=${sid}`;

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
