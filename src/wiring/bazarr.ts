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

export async function configureBazarrLanguages(
  opts: BazarrWiringOptions,
): Promise<void> {
  const base = opts.base ?? "http://localhost:6767";
  const languages = opts.languages.length > 0 ? opts.languages : ["en"];

  // Build the profile items. ids must be 1-indexed, unique per item.
  // audio_exclude/hi/forced are stringified booleans ("False") in Bazarr's DB
  // (see app/database.py migration code).
  const items = languages.map((lang, i) => ({
    id: i + 1,
    language: lang,
    audio_exclude: "False",
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
