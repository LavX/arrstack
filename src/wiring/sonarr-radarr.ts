import { withRetry } from "../lib/retry.js";

export async function configureArr(
  service: "sonarr" | "radarr",
  apiKey: string,
  opts: {
    rootFolder: string;
    extraFolders: string[];
    qbitUser: string;
    qbitPass: string;
    category: string;
  }
): Promise<void> {
  const port = service === "sonarr" ? 8989 : 7878;
  const base = `http://localhost:${port}`;
  const headers = { "X-Api-Key": apiKey, "Content-Type": "application/json" };

  // 1. Configure root folders
  const rfRes = await withRetry(() => fetch(`${base}/api/v3/rootfolder`, { headers }));
  if (!rfRes.ok) {
    throw new Error(`${service}: GET /api/v3/rootfolder failed: ${rfRes.status}`);
  }
  const existingFolders = (await rfRes.json()) as Array<{ path: string }>;
  const existingPaths = new Set(existingFolders.map((f) => f.path));

  const foldersToAdd = [opts.rootFolder, ...opts.extraFolders].filter(
    (p) => !existingPaths.has(p)
  );

  for (const path of foldersToAdd) {
    const addRes = await withRetry(() =>
      fetch(`${base}/api/v3/rootfolder`, {
        method: "POST",
        headers,
        body: JSON.stringify({ path }),
      })
    );
    if (!addRes.ok) {
      throw new Error(
        `${service}: POST /api/v3/rootfolder for "${path}" failed: ${addRes.status}`
      );
    }
  }

  // 2. Configure qBittorrent download client
  const dcRes = await withRetry(() => fetch(`${base}/api/v3/downloadclient`, { headers }));
  if (!dcRes.ok) {
    throw new Error(
      `${service}: GET /api/v3/downloadclient failed: ${dcRes.status}`
    );
  }
  const existingClients = (await dcRes.json()) as Array<{ implementation: string; fields: Array<{ name: string; value: unknown }> }>;

  const alreadyConfigured = existingClients.some(
    (c) =>
      c.implementation === "QBittorrent" &&
      c.fields.some(
        (f) => f.name === "host" && f.value === "qbittorrent"
      )
  );

  if (!alreadyConfigured) {
    const clientPayload = {
      enable: true,
      protocol: "torrent",
      priority: 1,
      name: "qBittorrent",
      implementation: "QBittorrent",
      configContract: "QBittorrentSettings",
      fields: [
        { name: "host", value: "qbittorrent" },
        { name: "port", value: 8080 },
        { name: "useSsl", value: false },
        { name: "urlBase", value: "" },
        { name: "username", value: opts.qbitUser },
        { name: "password", value: opts.qbitPass },
        { name: "category", value: opts.category },
        { name: "recentMoviePriority", value: 0 },
        { name: "olderMoviePriority", value: 0 },
        { name: "initialState", value: 0 },
        { name: "sequentialOrder", value: false },
        { name: "firstAndLast", value: false },
      ],
    };

    const addDcRes = await withRetry(() =>
      fetch(`${base}/api/v3/downloadclient`, {
        method: "POST",
        headers,
        body: JSON.stringify(clientPayload),
      })
    );
    if (!addDcRes.ok) {
      throw new Error(
        `${service}: POST /api/v3/downloadclient failed: ${addDcRes.status}`
      );
    }
  }
}
