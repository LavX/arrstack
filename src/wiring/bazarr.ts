import { withRetry } from "../lib/retry.js";

// Wires Bazarr's language settings and creates a default language profile via
// its REST API. Verified against /home/lavx/bazarr/bazarr/api/system/settings.py
// POST branches at lines 45 (languages-enabled) and 57 (languages-profiles).
// Auth uses the X-API-KEY header (see bazarr/api/utils.py:27).

export interface BazarrWiringOptions {
  apiKey: string;
  languages: string[]; // ISO 639-1 codes e.g. ["en", "hu"]
  base?: string;
}

async function readBody(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 2000); } catch { return ""; }
}

// Bazarr's /api/system/ping goes 200 quickly, but /api/system/settings POSTs
// during the first 30-60s often 500 while the DB migrations finish loading.
// Poll an authenticated endpoint until it returns 200; that is the real signal
// that the app + db + our config.yaml (with its apikey) are fully live.
async function waitForBazarrApiReady(
  base: string,
  apiKey: string,
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now();
  let lastStatus = 0;
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${base}/api/system/status`, {
        headers: { "X-API-KEY": apiKey },
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) return;
      lastStatus = r.status;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(
    `Bazarr API did not accept the configured key within ${timeoutMs / 1000}s ` +
    `(last HTTP ${lastStatus}). The config.yaml may not have been loaded — ` +
    `check that ${base}/api/system/ping returns 200 and that the api key ` +
    `matches installDir/config/bazarr/config/config.yaml.`,
  );
}

export async function configureBazarrLanguages(
  opts: BazarrWiringOptions,
): Promise<void> {
  const base = opts.base ?? "http://localhost:6767";
  const languages = opts.languages.length > 0 ? opts.languages : ["en"];

  // Gate on the authenticated readiness probe before the settings POST.
  await waitForBazarrApiReady(base, opts.apiKey);

  // Build the profile items. ids must be 1-indexed, unique per item.
  // Bazarr+ stores these flags as stringified booleans ("True"/"False") and
  // reads all four in subtitles/indexer/{movies,series}.py. Omitting
  // audio_only_include raises KeyError during the first missing-subtitles
  // index pass (verified against /home/lavx/bazarr/bazarr/subtitles/indexer
  // /movies.py:183 and app/database.py:564-568 which defaults both audio_*
  // keys to "False" during migration).
  const items = languages.map((lang, i) => ({
    id: i + 1,
    language: lang,
    audio_exclude: "False",
    audio_only_include: "False",
    hi: "False",
    forced: "False",
  }));

  const profile = {
    profileId: 1,
    name: `Default (${languages.join(", ")})`,
    cutoff: null,
    items,
    mustContain: "[]",
    mustNotContain: "[]",
    originalFormat: null,
    tag: null,
  };

  // POST /api/system/settings is form-encoded with repeated `languages-enabled`
  // and a single JSON string for `languages-profiles`.
  const form = new URLSearchParams();
  for (const lang of languages) form.append("languages-enabled", lang);
  form.append("languages-profiles", JSON.stringify([profile]));

  const res = await withRetry(() =>
    fetch(`${base}/api/system/settings`, {
      method: "POST",
      headers: {
        "X-API-KEY": opts.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }),
  );
  if (!res.ok) {
    throw new Error(
      `Bazarr settings update failed: HTTP ${res.status}\n${await readBody(res)}`,
    );
  }
}
