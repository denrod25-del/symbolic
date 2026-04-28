# Ad Management Portal — Phase 2 Design

**Date:** 2026-04-27
**Status:** Approved

---

## Goal

Advertisers can create, edit, pause/resume, and delete their own ads through a self-serve portal — a 3-step wizard to create ads and an ads list page to manage them.

---

## Context

Phase 1 delivered Clerk auth, the `advertisers` table, sign-in/sign-up pages, and a skeleton dashboard. The existing `ads` table already has every field needed (headline, destinationUrl, displayUrl, description, ctaText, keywords, bidPence, isActive, advertiserId). No DB migrations are required for Phase 2.

---

## Routes

| Route | Type | Purpose |
|---|---|---|
| `/advertise/ads` | Server component | List all ads for the signed-in advertiser |
| `/advertise/create` | Client component | 3-step wizard to create a new ad |
| `/advertise/ads/[id]/edit` | Client component | Same wizard pre-filled for editing |

---

## Navigation

The portal layout (`src/app/[locale]/(portal)/advertise/layout.tsx`) gains a **"My Ads"** nav link pointing to `/:locale/advertise/ads`, added alongside the existing Dashboard link.

The dashboard CTA button ("Create your first ad") is enabled and links to `/:locale/advertise/create`.

---

## Ads List Page — `/advertise/ads`

- **Server component** — fetches ads for the current advertiser via `currentUser()` → `advertiserId` → DB query.
- Renders a table with columns: Headline, Keywords (truncated), Bid (formatted as £X.XX), Status badge (Active / Paused).
- Per-row actions: **Edit** (links to `/advertise/ads/[id]/edit`), **Pause/Resume** (calls `toggleAdActive`), **Delete** (confirm dialog → calls `deleteAd`).
- Empty state: "No ads yet — create your first one" with a link to `/advertise/create`.
- "+ Create ad" button in the page header links to `/advertise/create`.

---

## Create/Edit Wizard — `/advertise/create` and `/advertise/ads/[id]/edit`

**Client component** with local React state tracking the current step (1–3). A single server action fires on final publish.

Edit mode pre-populates all fields from the existing ad. The same wizard component handles both routes — the page passes `initialData` when editing.

### Step 1: Ad content

Fields:
- Headline (required, max 80 chars)
- Destination URL (required, valid URL)
- Display URL (required, max 60 chars)
- Description (optional, max 200 chars)
- CTA text (required, max 30 chars)

### Step 2: Keywords

- Comma-separated free-text field.
- Helper text: "Enter keywords that trigger your ad on search results."
- Stored as a single string in the `keywords` column.

### Step 3: Bid (cost-per-click)

- £ amount input, stored as integer pence in `bidPence`.
- Minimum £0.10 (10 pence). Enforced in Zod schema and shown as helper text.
- No payment taken in Phase 2 — Stripe billing is Phase 3.

**Navigation:** Back / Next buttons between steps. "Publish ad" on Step 3 submits. Validation errors returned from the server action are shown inline on the relevant step.

---

## Server Actions — `src/libs/adActions.ts`

All writes are server actions (`'use server'`). Each action:
1. Calls `currentUser()` to get the Clerk user ID.
2. Looks up the `advertiserId` for that user.
3. Verifies the ad belongs to that advertiser (except `createAd`).
4. Performs the DB operation.

### `createAd(data: AdFormData)`

- Validates `data` against the Zod schema.
- Inserts a new row into `ads` with `isActive: true`.
- Returns `{ success: true }` — the client wizard calls `router.push(`/${locale}/advertise/ads`)` on success.
- Returns `{ error: string }` on validation failure.

### `updateAd(id: number, data: AdFormData)`

- Validates `data` against the Zod schema.
- Verifies ownership (ad's `advertiserId` matches current user).
- Updates the row in `ads`.
- Returns `{ success: true }` — the client wizard calls `router.push(`/${locale}/advertise/ads`)` on success.
- Returns `{ error: string }` on validation or ownership failure.

### `toggleAdActive(id: number, locale: string)`

- Verifies ownership.
- Flips `isActive` on the ad.
- Calls `revalidatePath(`/${locale}/advertise/ads`)` to refresh the list.
- Returns `{ error: string }` on ownership failure.

### `deleteAd(id: number, locale: string)`

- Verifies ownership.
- Deletes the row.
- Calls `revalidatePath(`/${locale}/advertise/ads`)`.
- Returns `{ error: string }` on ownership failure.

---

## Validation Schema

Defined once in `src/libs/adActions.ts` and shared between `createAd` and `updateAd`:

```ts
const adFormSchema = z.object({
  headline:       z.string().min(1).max(80),
  destinationUrl: z.string().url(),
  displayUrl:     z.string().min(1).max(60),
  description:    z.string().max(200),
  ctaText:        z.string().min(1).max(30),
  keywords:       z.string().min(1),
  bidPence:       z.number().int().min(10),
});

type AdFormData = z.infer<typeof adFormSchema>;
```

---

## Error Handling

- Server action validation errors → returned as `{ error: string }` → displayed inline in the wizard step containing the failing field.
- Ownership failures → returned as `{ error: string }` → shown as a top-level error message.
- No unhandled throws; actions return typed results.

---

## Middleware

`src/middleware.ts` already protects `/:locale/advertise/dashboard(.*)`. It needs updating to also protect `/advertise/ads(.*)` and `/advertise/create`:

```ts
const isProtectedRoute = createRouteMatcher([
  '/:locale/advertise/dashboard(.*)',
  '/:locale/advertise/ads(.*)',
  '/:locale/advertise/create(.*)',
]);
```

---

## Testing

- Unit tests in `src/libs/adActions.test.ts` covering:
  - `createAd` inserts and returns `{ success: true }`.
  - `createAd` rejects invalid data (bad URL, bid below minimum).
  - `updateAd` updates and returns `{ success: true }`.
  - `updateAd` rejects ad owned by another advertiser.
  - `toggleAdActive` flips the flag.
  - `deleteAd` removes the row.
- Tests use PGLite (same approach as `advertisers.test.ts`) with `beforeEach`/`afterEach` isolation.
- No E2E tests in Phase 2.

---

## Out of Scope (Phase 3+)

- Payment / Stripe billing for CPC spend.
- Analytics dashboard (impressions, clicks, CTR).
- Ad approval workflow.
- Domain and SSL setup.

---

## File Summary

| File | Change |
|---|---|
| `src/middleware.ts` | Add `/advertise/ads(.*)` and `/advertise/create(.*)` to protected routes |
| `src/app/[locale]/(portal)/advertise/layout.tsx` | Add "My Ads" nav link |
| `src/app/[locale]/(portal)/advertise/dashboard/page.tsx` | Enable CTA button, link to `/advertise/create` |
| `src/app/[locale]/(portal)/advertise/ads/page.tsx` | NEW: ads list server component |
| `src/app/[locale]/(portal)/advertise/create/page.tsx` | NEW: wizard page (create mode) |
| `src/app/[locale]/(portal)/advertise/ads/[id]/edit/page.tsx` | NEW: wizard page (edit mode, pre-filled) |
| `src/components/AdWizard.tsx` | NEW: 3-step client component wizard |
| `src/libs/adActions.ts` | NEW: createAd, updateAd, toggleAdActive, deleteAd |
| `src/libs/adActions.test.ts` | NEW: unit tests for all actions |
