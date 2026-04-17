# 07. Providers setup

The installer ships with 8 public indexers and a Bazarr+ config, but several services need you to log in with your own accounts before they work well: OpenSubtitles for better subtitle coverage, OpenRouter for the AI translator in Bazarr+, and sometimes private tracker API keys for Prowlarr. This page walks through each one and covers common indexer health problems.

## TL;DR

| Provider         | Where to configure          | Cost | Needed for |
|------------------|-----------------------------|------|------------|
| OpenSubtitles.com | Bazarr+, Settings, Providers | Free tier OK, VIP better | Most subtitle results |
| Addic7ed         | Bazarr+, Settings, Providers | Free account             | English/Spanish TV subs |
| Subf2m           | Bazarr+, Settings, Providers | No login                 | Indie languages |
| OpenRouter       | Bazarr+, Settings, Translator | Pay per token           | AI subtitle translation |
| Private indexers | Prowlarr, Add Indexer        | Depends                  | Private trackers in Sonarr/Radarr |

## Bazarr+ subtitle providers

Open Bazarr+ at http://localhost:6767, log in (admin credentials from `~/arrstack/admin.txt`), go to Settings, Providers. The defaults enabled by the installer are OpenSubtitles.com, Addic7ed, Subf2m. You still need to provide credentials for the first two.

### OpenSubtitles.com (free tier vs VIP)

1. Register at https://www.opensubtitles.com/.
2. Bazarr+, Settings, Providers, OpenSubtitles.com.

| Field         | Value |
|---------------|-------|
| Username      | your email or username |
| Password      | account password |
| VIP           | check if you have a paid plan |

Free tier: 20 downloads per day. Hit it, and Bazarr+ silently stops finding subs for the rest of the day. VIP: 1000 per day.

If you run a large library, VIP at a few dollars a month saves hours of "missing subs" frustration. Free is fine for a few new releases per week.

### Addic7ed

1. Register at https://www.addic7ed.com/.
2. In Bazarr+ provider settings, set Username, Password, Random user-agent.

Addic7ed limits you to 10 downloads per day without a VIP upgrade. Good for English and Spanish TV, weaker for movies. Keep it enabled as a fallback.

### Subf2m

No login. Enable it and forget about it. Decent coverage for Farsi, Arabic, Turkish, and smaller European languages.

### OpenSubtitles.org (legacy)

Different site from OpenSubtitles.com. Do not enable both. The `.com` version is the maintained one.

## OpenRouter AI translator (LavX fork feature)

The LavX fork of Bazarr+ ships an OpenRouter-backed translator that fills gaps where no human subtitle exists in your target language. Configure once, it runs automatically on any failed search.

> **Bring your own key.** OpenRouter has a free tier with rate-limited models, so you can test the translator at zero cost before putting a card on file. Paid models run a few cents per movie. arrstack never proxies your key anywhere, the request goes directly from your Bazarr+ container to OpenRouter.

### Get a key

1. Sign up at https://openrouter.ai/. The free tier gives you access to rate-limited free models with no card required.
2. Keys, Create Key. Name it `arrstack-bazarr`.
3. Copy the key, it starts with `sk-or-`.
4. Optional: add a few dollars of credit if you want paid models. Translations cost cents per movie.

### Configure Bazarr+

Bazarr+, Settings, Translator (LavX-only section):

| Field              | Suggested value |
|--------------------|-----------------|
| Enable translator  | on |
| Provider           | OpenRouter |
| API key            | `sk-or-...` |
| Default model      | `anthropic/claude-3-haiku` or `openai/gpt-4o-mini` |
| Source language    | Auto-detect |
| Target languages   | same list as your Bazarr+ language profile |
| Cost cap per file  | `0.05` (USD, optional safety cap) |

Trigger a manual translation on one item first. Open a movie in Bazarr+, Actions, Translate to test cost and quality. Then turn on automatic.

## Private indexers in Prowlarr

If you use private trackers, add them alongside the 8 public ones the installer seeded.

1. Prowlarr, Indexers, Add Indexer.
2. Search the definition by name.
3. Fill in the credentials the tracker gave you (API key, passkey, RSS key).
4. **Important:** before saving, click the Sync Profiles tab, attach the `flaresolverr` tag only if the tracker sits behind Cloudflare. Most private trackers do not.
5. Save. Test. Push to Sonarr and Radarr via Prowlarr's Sync button if it does not auto-sync.

### Why the tag matters at create time

The installer's Prowlarr bootstrap attaches `flaresolverr` to the 8 public indexers **at creation time**. Prowlarr does not re-evaluate FlareSolverr routing on subsequent edits. If you add a new public indexer by hand and forget the tag, FlareSolverr will not be consulted, and searches will fail with HTTP 403 on the first Cloudflare challenge.

To fix after the fact:

1. Indexers, edit the problem indexer.
2. Remove it, then re-add it with the tag attached before first save.

Yes, this is annoying. It is a Prowlarr behavior, not an arrstack bug.

## Common indexer health issues

Prowlarr shows a red ring next to unhealthy indexers. Click it to see the error.

| Error                                  | Cause | Fix |
|----------------------------------------|-------|-----|
| `HTTP 403 from Cloudflare challenge`   | FlareSolverr skipped or down | Check tag, check `docker ps | grep flaresolverr` |
| `HTTP 429 rate limited`                | Too many queries in short window | Prowlarr, indexer, Settings, Query Limit, raise interval |
| `Search cap reached`                   | Daily limit, usually free-tier indexers | Wait, or upgrade |
| `DNS resolution failed`                | Container lost network | `docker compose restart prowlarr` |
| `SSL handshake failed`                 | Indexer moved domains | Check the indexer's Reddit/Discord, update definition |
| `Captcha required`                     | Site now requires human login | Definition may be dead. Remove the indexer. |

### Checking FlareSolverr

```bash
# Is it up?
docker ps | grep flaresolverr

# Is it solving?
curl -X POST http://localhost:8191/v1 \
  -H 'Content-Type: application/json' \
  -d '{"cmd":"request.get","url":"https://www.google.com","maxTimeout":60000}' | jq .status
# Expect "ok"
```

If the FS container is churning CPU, the site's challenge changed. Update the FS image: `arrstack update` usually fixes it.

### When a public indexer dies

Public indexers come and go. The installer's seed list reflects what worked at install time. When one dies:

1. Remove it in Prowlarr to stop the red ring from spamming health checks.
2. Check https://prowlarr.servarr.com/ for the current list of working definitions.
3. Add a replacement through Prowlarr's indexer picker. Remember the FlareSolverr tag.

## Testing the full subtitle chain

Pick a recent movie you already have, delete its subs, force a search.

```bash
# Find a movie
ls ~/arrstack/data/media/movies/ | tail -1

# Delete existing subs
rm ~/arrstack/data/media/movies/"Some Movie (2024)"/*.srt

# In Bazarr+ UI: Movies, click the movie, Search subtitles
# Watch History for provider responses and scores
```

You should see Bazarr+ try OpenSubtitles.com first (highest score), then fall back to Addic7ed and Subf2m. If all three fail and OpenRouter is configured, the AI translator kicks in.

## Rate limit budgets at a glance

| Provider           | Free cap        | Paid cap      |
|--------------------|-----------------|---------------|
| OpenSubtitles.com  | 20/day          | 1000/day (VIP) |
| Addic7ed           | 10/day          | Higher with VIP |
| Subf2m             | No official cap | N/A |
| OpenRouter         | Pay per token   | Your card     |

Plan for about 3 providers at a time. Adding too many slows searches down because each one is queried sequentially.

## Next steps

- [03. Daily use](03-daily-use.md): watch the subtitle chain run end-to-end on a real import.
- [02. First run](02-first-run.md): Prowlarr health and indexer smoke test.
- [09. Updating](09-updating.md): FlareSolverr breaks often, update as needed.
