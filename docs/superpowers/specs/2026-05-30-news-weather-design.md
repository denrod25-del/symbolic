# Tech News + Weather Design (Phase 4)

**Date:** 2026-05-30
**Status:** Approved

## Goal

Give visitors a reason to return to Symbolic daily: a weather chip with severe-weather
alerts (branded "Weather by CrewCast") on every marketing page, a full forecast page,
and an aggregated tech-news feed — a strip below the homepage fold and a full
`/discover` page with categories and per-user source preferences.

The homepage keeps its minimalist Earth-hero identity. News lives below the fold and
on its own page — not Bing-style density around the search bar.

## Scope

**In scope (Approach 3 — Full):**
- Weather chip on all marketing pages: current temp, expandable card, 3-day compact
  forecast, alerts, °F/°C toggle
- Severity-tiered alert UX (red site-wide banner for Severe/Extreme; amber chip badge
  for Moderate; Minor only inside the expanded chip)
- `/weather` page: current conditions, active alerts, 12-hour strip, 7-day forecast
- Location via browser geolocation with manual city/zip override in Settings
- RSS news aggregator (The Verge, TechCrunch, Ars Technica, Wired, Hacker News),
  15-minute cron refresh, cached in Postgres
- Homepage "Tech today" strip (6 cards) below the fold
- `/discover` page with category tabs (All / AI / Startups / Security / Devices)
- Per-user source hiding for signed-in (Clerk) users
- Footer gains a "Discover" link

**Out of scope (deferred):**
- Radar/precipitation maps (OpenWeatherMap tiles are a separate paid product)
- Article-body scraping or reader view — cards link out to publishers
- Click tracking on news cards
- News pagination or infinite scroll (24 most recent per category)
- Anonymous-user personalization

## External services

- **OpenWeatherMap One Call API 3.0** — current + hourly + daily + alerts in one
  call. Free tier 1,000 calls/day. Key in `OPENWEATHER_API_KEY` (added to `Env.ts`).
  Geocoding for manual city/zip entry uses OpenWeatherMap's free geocoding endpoint.
- **RSS feeds** — The Verge, TechCrunch, Ars Technica, Wired, Hacker News front page.
  No keys, no cost.
- **CrewCast** — branding only ("Weather by CrewCast" linking to the CrewCast site).
  CrewCast has no API; Symbolic calls OpenWeatherMap directly.

## Architecture

### Weather

- `src/libs/weather.ts` — server-side OpenWeatherMap wrapper. Maps OWM JSON to an
  internal shape: `{ current, hourly (12), daily (7), alerts[] }`. Each alert gets a
  computed `tier: 'severe' | 'moderate' | 'minor'` from the OWM event/severity.
- `src/app/api/weather/route.ts` — `GET ?lat=..&lon=..` returns the mapped JSON.
  Server-side in-memory cache ~10 minutes per location cell; coordinates rounded to
  2 decimals (~1 km) for the cache key, so the free tier serves thousands of visitors.
- Client location: `localStorage` key `symbolic_location` (`{ lat, lon, label }`).
  Set by the browser geolocation prompt (chip click on first visit) or by the manual
  city/zip field on the Settings page (geocoded server-side). Unit preference
  (`symbolic_units`, default °F) also in `localStorage`.

### News

- New table `news_articles`: `id`, `source` (text: verge | techcrunch | ars | wired |
  hn), `category` (text: ai | startups | security | devices | general), `title`,
  `url` (unique index), `imageUrl` (nullable), `publishedAt`, `fetchedAt`.
- New table `news_preferences`: `id`, `clerkUserId` (unique), `hiddenSources`
  (text[], default empty).
- `src/libs/news.ts` — fetches and parses the 5 RSS feeds; each feed is independent
  (one failure never blocks the others). Categorizes by keyword rules on the title
  (e.g. AI/GPT/model → ai; raises/funding/seed → startups; breach/vulnerability/CVE →
  security; iPhone/laptop/chip → devices; else general). Upserts by `url`.
- `src/app/api/news/refresh/route.ts` — POST/GET guarded by
  `Authorization: Bearer $CRON_SECRET` (new env var). Calls the aggregator. Invoked
  every 15 minutes by a VPS crontab entry. Unauthorized → 401.
- Pages read from Postgres only — no external calls at render time.

## Weather UI

### Chip (all marketing pages, top-right)

- Collapsed: pill with icon + temp (`🌤 78°F`). No stored location → `📍 Weather`;
  clicking triggers the geolocation prompt; if denied, links to Settings.
- Amber dot on the pill while a Moderate alert is active.
- Expanded (click): current conditions (temp, feels-like, wind, humidity), today's
  high/low, next 3 days compact, active alerts with severity colors, °F/°C toggle,
  "Full forecast →" link to `/weather`, and "Weather by CrewCast" attribution.

### Severe alert banner

- Site-wide on marketing pages while any stored-location alert is tier `severe`:
  full-width red banner (`⚠ TORNADO WARNING — until 4:15 PM · Details`). "Details"
  opens the expanded chip. Dismissible; dismissal keyed by alert id in
  `sessionStorage` (returns next session while the alert is active).

### `/weather` page

- Hero: big temp, description, location label, "Change location" link to Settings.
- Active alerts: full text, severity-colored cards.
- Hourly strip: next 12 hours (icon + temp).
- 7-day forecast cards: icon, high/low, precipitation chance.
- "Weather by CrewCast" attribution footer.

## News UI

### Homepage strip

- The Earth hero stays full-viewport with a subtle `▾ Discover` hint at the bottom.
- Below the fold: "Tech today" heading, 6 latest cards (image, source badge, title,
  relative time), "More on Discover →" link. Cards open the article in a new tab.

### `/discover` page

- Category tabs (All / AI / Startups / Security / Devices) driven by a `?category=`
  search param, server-rendered — same filter-tab pattern as the admin ads page.
- Grid of the 24 most recent articles for the category (image, source badge,
  relative time).
- Sources popover: signed-in users check/uncheck the 5 sources; saved to
  `news_preferences` via a server action; hidden sources are excluded from their
  grid. Anonymous users see a sign-in hint instead.
- Empty state: "Nothing here yet — check back soon."
- Footer gains a "Discover" link next to "Submit a site".

### Images

- Only RSS-provided data is displayed (title, source, feed image), linking out to
  the publisher — standard aggregator practice. Feed images render as lazy-loaded
  plain `<img>` (feed image hosts vary too much for `next/image` remotePatterns).

## Error handling

- Weather fetch fails → chip hides; `/weather` shows "Weather is unavailable right
  now." No error boundaries triggered.
- Geolocation denied → chip links to Settings; never re-prompts on its own.
- A feed that fails to parse is skipped for that cycle and logged; other feeds
  proceed.
- Refresh endpoint without the bearer secret → 401.
- `/discover` with no articles (fresh deploy) → empty state, no crash.

## Testing

Real PGLite for DB tests, mocked `fetch` for external calls — same patterns as
Phases 1–3.

- `src/libs/news.test.ts` — categorization rules; upsert dedupes by URL; one bad
  feed doesn't block others (fixture RSS XML).
- `src/libs/weather.test.ts` — OWM JSON mapping; cache-key coordinate rounding;
  alert tier mapping; mocked fetch.
- News-preferences server action — signed-in save/load; anonymous refused.
- E2E smoke: `/discover` renders tabs and grid.

## Ops / deploy checklist (manual steps)

1. Create an OpenWeatherMap account, subscribe to One Call 3.0 free tier, add
   `OPENWEATHER_API_KEY` to the VPS `.env.local`.
2. Generate a random `CRON_SECRET`, add to the VPS `.env.local`.
3. Run the new migration (two tables) manually on the VPS.
4. Add the crontab entry:
   `*/15 * * * * curl -s -H "Authorization: Bearer <secret>" https://bsymbolic.com/api/news/refresh`

## Implementation split

One spec, **two independent plans**:

- **Plan A — Weather:** `weather.ts`, `/api/weather`, chip, alert banner, `/weather`
  page, Settings location field, Env changes, tests.
- **Plan B — News:** migration (both tables land here), `news.ts`, refresh endpoint,
  homepage strip, `/discover`, sources popover + server action, footer link, cron
  docs, tests.

Either can ship alone; neither blocks the other.
