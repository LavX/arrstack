import { request } from "undici";

export async function setupJellyfin(
  adminUser: string,
  adminPass: string,
  libraries: Array<{ name: string; type: string; paths: string[] }>,
  base = "http://localhost:8096"
): Promise<void> {
  // 1. Complete startup configuration
  const configRes = await request(`${base}/Startup/Configuration`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      UICulture: "en-US",
      MetadataCountryCode: "US",
      PreferredMetadataLanguage: "en",
    }),
  });
  if (configRes.statusCode < 200 || configRes.statusCode >= 300) {
    await configRes.body.dump();
    throw new Error(`Startup/Configuration failed: HTTP ${configRes.statusCode}`);
  }
  await configRes.body.dump();

  // 2. Set admin credentials
  const userRes = await request(`${base}/Startup/User`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Name: adminUser, Password: adminPass }),
  });
  if (userRes.statusCode < 200 || userRes.statusCode >= 300) {
    await userRes.body.dump();
    throw new Error(`Startup/User failed: HTTP ${userRes.statusCode}`);
  }
  await userRes.body.dump();

  // 3. Authenticate to get AccessToken
  const authHeader =
    'MediaBrowser Client="arrstack", Device="installer", DeviceId="arrstack", Version="1.0.0"';
  const authRes = await request(`${base}/Users/AuthenticateByName`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Emby-Authorization": authHeader,
    },
    body: JSON.stringify({ Username: adminUser, Pw: adminPass }),
  });
  if (authRes.statusCode < 200 || authRes.statusCode >= 300) {
    await authRes.body.dump();
    throw new Error(`AuthenticateByName failed: HTTP ${authRes.statusCode}`);
  }
  const authData = (await authRes.body.json()) as { AccessToken: string };
  const token = authData.AccessToken;

  const authedHeaders = {
    "Content-Type": "application/json",
    "X-Emby-Authorization": `${authHeader}, Token="${token}"`,
  };

  // 4. Create each library
  for (const lib of libraries) {
    const url = `${base}/Library/VirtualFolders?name=${encodeURIComponent(lib.name)}&collectionType=${encodeURIComponent(lib.type)}&refreshLibrary=true`;
    const libRes = await request(url, {
      method: "POST",
      headers: authedHeaders,
      body: JSON.stringify({
        LibraryOptions: {
          PathInfos: lib.paths.map((p) => ({ Path: p })),
        },
      }),
    });
    if (libRes.statusCode < 200 || libRes.statusCode >= 300) {
      await libRes.body.dump();
      throw new Error(`Failed to create library "${lib.name}": HTTP ${libRes.statusCode}`);
    }
    await libRes.body.dump();
  }

  // 5. Mark wizard complete
  const completeRes = await request(`${base}/Startup/Complete`, {
    method: "POST",
    headers: authedHeaders,
  });
  if (completeRes.statusCode < 200 || completeRes.statusCode >= 300) {
    await completeRes.body.dump();
    throw new Error(`Startup/Complete failed: HTTP ${completeRes.statusCode}`);
  }
  await completeRes.body.dump();
}
