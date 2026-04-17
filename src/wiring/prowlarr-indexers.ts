import { withRetry } from "../lib/retry.js";

interface IndexerField {
  name: string;
  value: string;
}

interface IndexerDefinition {
  name: string;
  implementation: string;
  configContract: string;
  fields: IndexerField[];
}

export const PUBLIC_INDEXERS: IndexerDefinition[] = [
  {
    name: "1337x",
    implementation: "Cardigann",
    configContract: "CardigannSettings",
    fields: [{ name: "definitionFile", value: "1337x" }],
  },
  {
    name: "The Pirate Bay",
    implementation: "Cardigann",
    configContract: "CardigannSettings",
    fields: [{ name: "definitionFile", value: "thepiratebay" }],
  },
  {
    name: "YTS",
    implementation: "Cardigann",
    configContract: "CardigannSettings",
    fields: [{ name: "definitionFile", value: "yts" }],
  },
  {
    name: "EZTV",
    implementation: "Cardigann",
    configContract: "CardigannSettings",
    fields: [{ name: "definitionFile", value: "eztv" }],
  },
  {
    // TorrentGalaxy shut down in Oct 2024; Prowlarr now ships a clone def.
    name: "TorrentGalaxyClone",
    implementation: "Cardigann",
    configContract: "CardigannSettings",
    fields: [{ name: "definitionFile", value: "torrentgalaxyclone" }],
  },
];

export async function addProwlarrIndexers(
  apiKey: string,
  baseUrl = "http://localhost:9696"
): Promise<number> {
  const headers = {
    "X-Api-Key": apiKey,
    "Content-Type": "application/json",
  };

  const listRes = await withRetry(() =>
    fetch(`${baseUrl}/api/v1/indexer`, { headers })
  );
  if (!listRes.ok) {
    throw new Error(`Failed to list indexers: HTTP ${listRes.status}`);
  }
  const existing = (await listRes.json()) as Array<{ name: string }>;
  const existingNames = new Set(existing.map((i) => i.name));

  let added = 0;
  for (const indexer of PUBLIC_INDEXERS) {
    if (existingNames.has(indexer.name)) {
      continue;
    }

    const body = JSON.stringify({
      name: indexer.name,
      implementation: indexer.implementation,
      configContract: indexer.configContract,
      // Prowlarr rejects POST /api/v1/indexer unless both of these are set:
      //   - appProfileId must be > 0; 1 is the default "Standard" profile
      //     that Prowlarr seeds on first boot.
      //   - priority must be between 1 and 50; 25 is a neutral middle.
      // Verified live: without either, Prowlarr returns 400 with
      // GreaterThanValidator / InclusiveBetweenValidator messages.
      appProfileId: 1,
      priority: 25,
      fields: indexer.fields,
      enableRss: true,
      enableAutomaticSearch: true,
      enableInteractiveSearch: true,
    });

    const res = await withRetry(() =>
      fetch(`${baseUrl}/api/v1/indexer`, {
        method: "POST",
        headers,
        body,
      })
    );

    if (res.status !== 201 && res.status !== 200) {
      // Public tracker definitions disappear upstream (site shutdowns, rename
      // to *Clone, etc.). Don't fail the whole install for a single dead
      // indexer — log the specific failure and move on. The user can add
      // current indexers manually via the Prowlarr UI.
      let body = "";
      try { body = (await res.text()).slice(0, 300); } catch { /* ignore */ }
      console.error(
        `[prowlarr] skipping "${indexer.name}" (HTTP ${res.status}): ${body}`,
      );
      continue;
    }

    added++;
  }

  return added;
}
