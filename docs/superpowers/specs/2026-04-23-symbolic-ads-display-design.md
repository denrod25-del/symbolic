# Symbolic — Phase 2: Ad Display Design

**Date:** 2026-04-23
**Status:** Approved

---

## Overview

Add a keyword-targeted, CPC-priced ad system to the Symbolic search engine. Ads appear in two slots (top and bottom of organic results) using a rich card format. The implementation is database-backed with Drizzle ORM and PostgreSQL (PGlite locally).

---

## 1. Data Model

### `ads` table

| Column | Type | Notes |
|---|---|---|
| `id` | `serial primary key` | |
| `advertiser_name` | `text not null` | Internal label only |
| `title` | `text not null` | Headline shown in ad |
| `url` | `text not null` | Destination URL for click redirect |
| `display_url` | `text not null` | Friendly URL shown in green |
| `description` | `text not null` | Body copy under the title |
| `cta_text` | `text not null` | CTA button label (e.g. "Shop Now →") |
| `keywords` | `text[] not null` | Targeting keywords array |
| `bid_amount` | `integer not null` | CPC bid in US cents |
| `active` | `boolean not null default true` | Kill switch |
| `created_at` | `timestamp not null defaultNow()` | |

### `ad_clicks` table

| Column | Type | Notes |
|---|---|---|
| `id` | `serial primary key` | |
| `ad_id` | `integer not null` references `ads(id)` | |
| `query` | `text not null` | Search query that triggered the ad |
| `clicked_at` | `timestamp not null defaultNow()` | |

---

## 2. Keyword Targeting

Matching uses PostgreSQL's `&&` array overlap operator: an ad matches a query if any of its `keywords` appear in the search query words.

```sql
SELECT * FROM ads
WHERE active = true
  AND keywords && ARRAY['running', 'shoes']::text[]
ORDER BY bid_amount DESC
LIMIT 2
```

**Important:** Drizzle ORM's query builder does not support `&&`. This query must be written as a raw SQL fragment using `sql\`...\`` from `drizzle-orm`. The `ARRAY[...]::text[]` cast is required for both PostgreSQL and PGlite compatibility.

**PGlite note:** PGlite supports the `&&` array operator, but requires the explicit `::text[]` cast on the literal array parameter. Without it, PGlite may fail to resolve the operator overload.

The `selectAds(query: string)` function in `src/libs/ads.ts`:
1. Lowercases and tokenises the search query into words (split on whitespace/punctuation)
2. Runs the raw SQL query above
3. Returns at most 2 ads (top slot + bottom slot)

---

## 3. Ad Card Format — Rich

Each ad renders as a card with a purple left border to distinguish it from organic results:

```
┌─ SPONSORED (purple, small caps) ──────────────────────────┐
│ displayurl.com/path  (green)                               │
│ Ad Headline Here  (purple, links to click route)           │
│ Description copy under the title. (muted grey)             │
│ [ CTA Button → ]  (purple filled button)                   │
└────────────────────────────────────────────────────────────┘
```

Component: `src/components/AdCard.tsx` — accepts a single `Ad` prop (typed from the DB schema). Renders as a `<div>`, not an `<article>`, to avoid ARIA conflicts with organic results.

The title and CTA button both link to the click-tracking route (see §5). The raw destination `url` is **never** exposed to the browser — the link always goes through `/api/ads/click?id=<id>&q=<query>`.

---

## 4. Ad Placement

Two slots on the search results page (`src/app/[locale]/(marketing)/search/page.tsx`):

- **Top slot:** rendered above `<ResultsList>`, inside the existing `data-slot="ad-top"` div (currently hidden)
- **Bottom slot:** rendered after `<Pagination>`

Both slots receive the same ads array from `selectAds()`. If only one ad is returned, it occupies the top slot; the bottom slot is empty. If no ads match, both slots are empty and render nothing (no placeholder shown to the user).

---

## 5. Click Tracking & CPC Route

**Route:** `GET /api/ads/click?id=<ad_id>&q=<query>`

**Handler** (`src/app/api/ads/click/route.ts`):
1. Parse and validate `id` (must be a positive integer) and `q` (string, may be empty)
2. Look up the ad in the DB by `id`
3. If not found or `active = false` → 404
4. Insert a row into `ad_clicks`
5. Redirect to `ad.url` (the DB-stored destination) — **never** redirect to any URL from the query string

**Security:** The destination URL always comes from the database row, not from user-supplied query parameters. This prevents open redirect attacks. The `url` query param does not exist in this route.

**Click counting:** `ad_clicks` rows are the source of truth. Revenue reporting can `GROUP BY ad_id` and `COUNT(*)` × `bid_amount`.

---

## 6. Environment & Database Wiring

### DATABASE_URL restoration (critical)

Phase 1 removed `DATABASE_URL` from `src/libs/Env.ts` and deleted `src/libs/DB.ts` and `src/libs/DBConnection.ts`. Phase 2 must restore all three:

- **`Env.ts`** — add `DATABASE_URL` as a required server env var (Zod `z.string().url()`)
- **`DB.ts`** — re-create using Drizzle + PGlite (local) / `postgres` driver (production), switching on `NODE_ENV`
- **`DBConnection.ts`** — singleton wrapper so the connection is shared across hot-reloads

The Playwright E2E tests run in a separate process. The `DATABASE_URL` env var must be forwarded in `playwright.config.ts` (pointing at PGlite or a test PostgreSQL instance).

### Migrations

Run via `drizzle-kit push` for local development. The migration adds the two new tables; it does not touch any existing table.

### Seed script

`scripts/seed-ads.ts` — inserts 2–3 sample ads with varied keyword arrays for development testing. Requires `DATABASE_URL` to be set in the shell; documents this in a comment at the top of the file.

---

## 7. Files Changed / Created

| File | Action |
|---|---|
| `src/libs/Env.ts` | Add `DATABASE_URL` server var |
| `src/libs/DB.ts` | Re-create: Drizzle + PGlite/postgres |
| `src/libs/DBConnection.ts` | Re-create: singleton DB connection |
| `src/db/Schema.ts` | Create: `ads` + `ad_clicks` table definitions |
| `src/libs/ads.ts` | Create: `selectAds(query)` using raw SQL `&&` |
| `src/components/AdCard.tsx` | Create: rich ad card component |
| `src/app/api/ads/click/route.ts` | Create: click tracking + redirect |
| `src/app/[locale]/(marketing)/search/page.tsx` | Wire top + bottom ad slots |
| `drizzle/` migrations | Generate via `drizzle-kit push` |
| `scripts/seed-ads.ts` | Create: dev seed data |
| `playwright.config.ts` | Forward `DATABASE_URL` to test env |

---

## 8. Error Fixes Baked In

The following issues were identified during design review and are addressed by this spec:

1. **DATABASE_URL missing** — Env.ts + DB files must be restored before any DB work begins (§6)
2. **Open redirect** — Click route uses DB-stored `url`, never user input (§5)
3. **Drizzle raw SQL for `&&`** — Must use `sql\`...\`` fragment; query builder does not support array overlap (§2)
4. **PGlite cast required** — `ARRAY[...]::text[]` cast prevents operator resolution failures in PGlite (§2)
5. **Seed script dependency** — `scripts/seed-ads.ts` requires `DATABASE_URL`; documented in file header (§6)

---

## 9. Out of Scope

- Admin UI for creating/editing ads (manual DB inserts for now)
- Impression tracking (clicks only)
- Budget caps or daily spend limits
- Geo-targeting or device targeting
- A/B testing ad copy
- Invoicing or payment collection
