import { request } from "undici";

export async function linkJellyseerr(
  jellyfinUser: string,
  jellyfinPass: string,
  base = "http://localhost:5055"
): Promise<void> {
  const res = await request(`${base}/api/v1/auth/jellyfin`, {
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
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    await res.body.dump();
    throw new Error(`Jellyseerr auth failed: HTTP ${res.statusCode}`);
  }

  await res.body.dump();
}
