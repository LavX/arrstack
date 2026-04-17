import { request } from "undici";

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
    name: "TorrentGalaxy",
    implementation: "Cardigann",
    configContract: "CardigannSettings",
    fields: [{ name: "definitionFile", value: "torrentgalaxy" }],
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

  const listRes = await request(`${baseUrl}/api/v1/indexer`, { headers });
  if (listRes.statusCode !== 200) {
    throw new Error(`Failed to list indexers: HTTP ${listRes.statusCode}`);
  }
  const existing = (await listRes.body.json()) as Array<{ name: string }>;
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
      fields: indexer.fields,
      enableRss: true,
      enableAutomaticSearch: true,
      enableInteractiveSearch: true,
    });

    const res = await request(`${baseUrl}/api/v1/indexer`, {
      method: "POST",
      headers,
      body,
    });

    if (res.statusCode !== 201 && res.statusCode !== 200) {
      throw new Error(
        `Failed to add indexer "${indexer.name}": HTTP ${res.statusCode}`
      );
    }

    added++;
  }

  return added;
}
