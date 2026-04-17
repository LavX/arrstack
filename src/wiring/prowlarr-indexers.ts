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

// Curated defaults — English-language public trackers covering Movies + TV
// + Audio + Books + PC. Mix of CF-gated (routed through FlareSolverr which
// the installer wires into Prowlarr in configureProwlarrFlaresolverr) and
// non-gated sites so the pipeline stays usable even if one category breaks.
// addProwlarrIndexers continues past individual test failures, so a dead
// site at install time just means 4 indexers instead of 8 — it won't fail
// the install.
export const PUBLIC_INDEXERS: IndexerDefinition[] = [
  // CF-gated — depends on FlareSolverr for CloudFlare JS challenge solving.
  {
    name: "1337x",
    implementation: "Cardigann",
    configContract: "CardigannSettings",
    fields: [{ name: "definitionFile", value: "1337x" }],
  },
  {
    // TorrentGalaxy shut down Oct 2024; Prowlarr ships a clone def.
    name: "TorrentGalaxyClone",
    implementation: "Cardigann",
    configContract: "CardigannSettings",
    fields: [{ name: "definitionFile", value: "torrentgalaxyclone" }],
  },
  {
    name: "EZTV",
    implementation: "Cardigann",
    configContract: "CardigannSettings",
    fields: [{ name: "definitionFile", value: "eztv" }],
  },
  // Non-CF fallbacks that tested HTTP 200 against /indexer/test directly.
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
    name: "LimeTorrents",
    implementation: "Cardigann",
    configContract: "CardigannSettings",
    fields: [{ name: "definitionFile", value: "limetorrents" }],
  },
  {
    name: "Torrent Downloads",
    implementation: "Cardigann",
    configContract: "CardigannSettings",
    fields: [{ name: "definitionFile", value: "torrentdownload" }],
  },
  {
    name: "Magnet Cat",
    implementation: "Cardigann",
    configContract: "CardigannSettings",
    fields: [{ name: "definitionFile", value: "magnetcat" }],
  },
];

export async function addProwlarrIndexers(
  apiKey: string,
  // Tag every created indexer with this (the FlareSolverr tag). Prowlarr
  // then routes requests through FlareSolverr for the indexers that need
  // CF challenge solving; others pass through unchanged. Tag must be
  // present at CREATE time — adding it later via PUT does not clear the
  // cooldown Prowlarr puts on an indexer that failed its initial probe.
  flaresolverrTagId?: number,
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
      // Top-level `enable` is required — it defaults to False on POST if
      // omitted, which (a) makes the indexer useless and (b) blocks the
      // auto-push to Sonarr/Radarr since only enabled indexers sync.
      enable: true,
      // Stamp FlareSolverr tag at CREATE time. Any CF-gated indexer (1337x,
      // TGClone, sometimes MagnetCat) routes through the proxy; non-gated
      // ones ignore it. Tagging via PUT after creation doesn't clear the
      // indexer's cooldown from its initial untagged probe.
      tags: flaresolverrTagId !== undefined ? [flaresolverrTagId] : [],
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
