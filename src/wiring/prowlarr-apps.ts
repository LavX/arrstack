import { request } from "undici";

interface AppField {
  name: string;
  value: string | number | number[];
}

interface AppDefinition {
  name: string;
  implementation: string;
  configContract: string;
  fields: AppField[];
}

const RADARR_SYNC_CATEGORIES = [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060, 2070, 2080];
const SONARR_SYNC_CATEGORIES = [5030, 5040, 5045, 5090];

function buildSonarrApp(prowlarrUrl: string, apiKey: string): AppDefinition {
  return {
    name: "Sonarr",
    implementation: "Sonarr",
    configContract: "SonarrSettings",
    fields: [
      { name: "prowlarrUrl", value: prowlarrUrl },
      { name: "baseUrl", value: "http://sonarr:8989" },
      { name: "apiKey", value: apiKey },
      { name: "syncCategories", value: SONARR_SYNC_CATEGORIES },
    ],
  };
}

function buildRadarrApp(prowlarrUrl: string, apiKey: string): AppDefinition {
  return {
    name: "Radarr",
    implementation: "Radarr",
    configContract: "RadarrSettings",
    fields: [
      { name: "prowlarrUrl", value: prowlarrUrl },
      { name: "baseUrl", value: "http://radarr:7878" },
      { name: "apiKey", value: apiKey },
      { name: "syncCategories", value: RADARR_SYNC_CATEGORIES },
    ],
  };
}

async function upsertApp(
  app: AppDefinition,
  existingApps: Array<{ id: number; name: string }>,
  headers: Record<string, string>,
  baseUrl: string
): Promise<void> {
  const existing = existingApps.find((a) => a.name === app.name);
  const body = JSON.stringify(app);

  if (existing) {
    const res = await request(`${baseUrl}/api/v1/applications/${existing.id}`, {
      method: "PUT",
      headers,
      body,
    });
    if (res.statusCode !== 200 && res.statusCode !== 202) {
      throw new Error(
        `Failed to update application "${app.name}": HTTP ${res.statusCode}`
      );
    }
  } else {
    const res = await request(`${baseUrl}/api/v1/applications`, {
      method: "POST",
      headers,
      body,
    });
    if (res.statusCode !== 201 && res.statusCode !== 200) {
      throw new Error(
        `Failed to add application "${app.name}": HTTP ${res.statusCode}`
      );
    }
  }
}

async function triggerIndexerSync(
  headers: Record<string, string>,
  baseUrl: string
): Promise<void> {
  const body = JSON.stringify({ name: "ApplicationIndexerSync" });
  const res = await request(`${baseUrl}/api/v1/command`, {
    method: "POST",
    headers,
    body,
  });
  if (res.statusCode !== 201 && res.statusCode !== 200) {
    throw new Error(`Failed to trigger ApplicationIndexerSync: HTTP ${res.statusCode}`);
  }
}

export async function registerProwlarrApps(
  prowlarrKey: string,
  sonarrKey: string,
  radarrKey: string,
  baseUrl = "http://localhost:9696"
): Promise<void> {
  const headers = {
    "X-Api-Key": prowlarrKey,
    "Content-Type": "application/json",
  };

  const listRes = await request(`${baseUrl}/api/v1/applications`, { headers });
  if (listRes.statusCode !== 200) {
    throw new Error(`Failed to list applications: HTTP ${listRes.statusCode}`);
  }
  const existingApps = (await listRes.body.json()) as Array<{ id: number; name: string }>;

  const prowlarrUrl = baseUrl;
  const sonarrApp = buildSonarrApp(prowlarrUrl, sonarrKey);
  const radarrApp = buildRadarrApp(prowlarrUrl, radarrKey);

  await upsertApp(sonarrApp, existingApps, headers, baseUrl);
  await upsertApp(radarrApp, existingApps, headers, baseUrl);

  await triggerIndexerSync(headers, baseUrl);
}
