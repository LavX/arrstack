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
    // Docker network host Sonarr/Radarr use to reach qBittorrent. Normally the
    // "qbittorrent" container, but when qBittorrent is routed through the VPN it
    // shares gluetun's network namespace and has no name of its own, so it is
    // reachable as "gluetun". Defaults to "qbittorrent" for the non-VPN case.
    qbitHost?: string;
  }
): Promise<void> {
  const qbitHost = opts.qbitHost ?? "qbittorrent";
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
  const existingClients = (await dcRes.json()) as Array<{
    id: number;
    name: string;
    implementation: string;
    fields: Array<{ name: string; value: unknown }>;
  }>;

  // Force host (and credentials) onto a field list, leaving everything else as-is.
  const withHostAndCreds = (fields: Array<{ name: string; value: unknown }>) =>
    fields.map((f) => {
      if (f.name === "host") return { ...f, value: qbitHost };
      if (f.name === "username") return { ...f, value: opts.qbitUser };
      if (f.name === "password") return { ...f, value: opts.qbitPass };
      return f;
    });

  const existing = existingClients.find((c) => c.implementation === "QBittorrent");

  if (existing) {
    // A qBittorrent client already exists. If its host already matches, we are
    // done. Otherwise the VPN mode was toggled (host moves between "qbittorrent"
    // and "gluetun"), so UPDATE this client in place — POSTing a second one with
    // the same name is rejected by the arr APIs as a duplicate.
    const host = existing.fields.find((f) => f.name === "host")?.value;
    if (host === qbitHost) return;
    const updated = { ...existing, fields: withHostAndCreds(existing.fields) };
    const putRes = await withRetry(() =>
      fetch(`${base}/api/v3/downloadclient/${existing.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updated),
      })
    );
    if (!putRes.ok) {
      throw new Error(
        `${service}: PUT /api/v3/downloadclient/${existing.id} failed: ${putRes.status}`
      );
    }
    return;
  }

  const clientPayload = {
    enable: true,
    protocol: "torrent",
    priority: 1,
    name: "qBittorrent",
    implementation: "QBittorrent",
    configContract: "QBittorrentSettings",
    fields: [
      { name: "host", value: qbitHost },
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
