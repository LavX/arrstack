import { withRetry } from "../lib/retry.js";

// Wires FlareSolverr into Prowlarr so Cloudflare-protected indexers (1337x,
// TorrentGalaxyClone, some others) can be probed. Creates a `flaresolverr`
// tag, a FlareSolverr indexer proxy bound to that tag, and applies the tag to
// every registered indexer. Without this, every CF-gated indexer test fails
// and Prowlarr never has anything to push to Sonarr/Radarr.

export interface ProwlarrFlareOptions {
  apiKey: string;
  flaresolverrUrl?: string; // defaults to docker service name
  baseUrl?: string;
}

async function readBody(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 300); } catch { return ""; }
}

interface TagDto { id: number; label: string }
interface IndexerDto { id: number; name: string; tags?: number[]; [k: string]: unknown }

export async function configureProwlarrFlaresolverr(
  opts: ProwlarrFlareOptions,
): Promise<void> {
  const base = opts.baseUrl ?? "http://localhost:9696";
  const flareUrl = opts.flaresolverrUrl ?? "http://flaresolverr:8191/";
  const headers = { "X-Api-Key": opts.apiKey, "Content-Type": "application/json" };

  // 1. Ensure a `flaresolverr` tag exists (idempotent).
  const tagsRes = await withRetry(() => fetch(`${base}/api/v1/tag`, { headers }));
  if (!tagsRes.ok) throw new Error(`GET /tag failed: HTTP ${tagsRes.status}`);
  const tags = (await tagsRes.json()) as TagDto[];
  let tagId = tags.find((t) => t.label === "flaresolverr")?.id;
  if (tagId === undefined) {
    const mk = await withRetry(() =>
      fetch(`${base}/api/v1/tag`, {
        method: "POST",
        headers,
        body: JSON.stringify({ label: "flaresolverr" }),
      }),
    );
    if (!mk.ok) throw new Error(`POST /tag failed: HTTP ${mk.status}\n${await readBody(mk)}`);
    tagId = ((await mk.json()) as TagDto).id;
  }

  // 2. Ensure a FlareSolverr indexer proxy exists (idempotent by name).
  const proxiesRes = await withRetry(() => fetch(`${base}/api/v1/indexerproxy`, { headers }));
  if (!proxiesRes.ok) throw new Error(`GET /indexerproxy failed: HTTP ${proxiesRes.status}`);
  const proxies = (await proxiesRes.json()) as Array<{ name: string }>;
  const alreadyExists = proxies.some((p) => p.name === "FlareSolverr");
  if (!alreadyExists) {
    const body = {
      name: "FlareSolverr",
      implementation: "FlareSolverr",
      configContract: "FlareSolverrSettings",
      tags: [tagId],
      fields: [
        { name: "host", value: flareUrl },
        { name: "requestTimeout", value: 60 },
      ],
    };
    const res = await withRetry(() =>
      fetch(`${base}/api/v1/indexerproxy`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    );
    if (!res.ok) {
      throw new Error(
        `POST /indexerproxy failed: HTTP ${res.status}\n${await readBody(res)}`,
      );
    }
  }

  // 3. Tag every indexer so it routes through FlareSolverr.
  const ixRes = await withRetry(() => fetch(`${base}/api/v1/indexer`, { headers }));
  if (!ixRes.ok) throw new Error(`GET /indexer failed: HTTP ${ixRes.status}`);
  const indexers = (await ixRes.json()) as IndexerDto[];
  for (const ix of indexers) {
    const existing = new Set(ix.tags ?? []);
    if (existing.has(tagId)) continue;
    existing.add(tagId);
    const updated = { ...ix, tags: [...existing] };
    const put = await withRetry(() =>
      fetch(`${base}/api/v1/indexer/${ix.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updated),
      }),
    );
    if (!put.ok && put.status !== 202) {
      // Don't abort for one bad indexer — just log and move on.
      console.error(
        `[prowlarr] tag-indexer "${ix.name}" HTTP ${put.status}: ${await readBody(put)}`,
      );
    }
  }
}

// After all apps are registered, re-PUT every indexer so Prowlarr re-syncs
// each one to the apps that now exist. Indexer auto-push only fires on
// CREATE, so indexers added before apps won't otherwise reach the apps.
export async function repushProwlarrIndexersToApps(
  apiKey: string,
  baseUrl = "http://localhost:9696",
): Promise<void> {
  const headers = { "X-Api-Key": apiKey, "Content-Type": "application/json" };
  const ixRes = await withRetry(() => fetch(`${baseUrl}/api/v1/indexer`, { headers }));
  if (!ixRes.ok) throw new Error(`GET /indexer failed: HTTP ${ixRes.status}`);
  const indexers = (await ixRes.json()) as IndexerDto[];
  for (const ix of indexers) {
    const put = await withRetry(() =>
      fetch(`${baseUrl}/api/v1/indexer/${ix.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(ix),
      }),
    );
    if (!put.ok && put.status !== 202) {
      console.error(
        `[prowlarr] repush "${ix.name}" HTTP ${put.status}: ${await readBody(put)}`,
      );
    }
  }
}
