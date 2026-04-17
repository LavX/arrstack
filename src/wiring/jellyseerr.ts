import { withRetry } from "../lib/retry.js";

export async function linkJellyseerr(
  jellyfinUser: string,
  jellyfinPass: string,
  base = "http://localhost:5055"
): Promise<void> {
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
      }),
    })
  );

  if (!res.ok) {
    throw new Error(`Jellyseerr auth failed: HTTP ${res.status}`);
  }
}
