# Admin Panel Design (Phase 3)

**Date:** 2026-05-17
**Status:** Approved

## Goal

Build an admin panel for the Symbolic ad platform: a moderation queue for reviewing
new ads before they serve, platform-wide visibility (stats, all ads, all advertisers),
and the ability to suspend ads. Admins are a small fixed set of people identified by
an email allowlist.

## Scope

**In scope (Approach 2 — Standard):**
- Admin dashboard with platform stats
- Pending ad review queue (approve / reject)
- Browse all ads with status filter + suspend/unsuspend
- Read-only advertiser list and advertiser detail

**Out of scope (deferred):**
- Editing ad content as an admin
- Suspending/banning an entire advertiser account
- Activity feed / event log
- Time-series charts
- A UI for managing the admin allowlist

## Access Control

Admins are identified by an email allowlist in an environment variable.

- `ADMIN_EMAILS` — comma-separated list of admin email addresses. Added to `Env.ts`
  schema as an optional string (defaults to empty).
- An admin is a signed-in Clerk user whose primary email is in `ADMIN_EMAILS`.
- Promote/demote an admin by editing the env var and redeploying.

UI visibility is never the security boundary — every admin page and every server
action re-checks admin status server-side.

## Architecture

- New route group `(admin)` at `src/app/[locale]/(admin)/admin/...`.
- Routes: `/admin/dashboard`, `/admin/queue`, `/admin/ads`, `/admin/advertisers`,
  `/admin/advertisers/[id]`.
- A shared `(admin)` layout renders the admin nav and runs `requireAdmin()` so every
  admin page is gated.
- Middleware adds `/:locale/admin(.*)` to the protected-route matcher (requires Clerk
  login). The email-allowlist check happens in the layout, not middleware.
- Auth helper: `src/libs/admin.ts`.
- Server actions: `src/libs/adminActions.ts`.

## Schema Changes

Add four columns to the `ads` table in `src/models/Schema.ts`:

| Column | Type | Notes |
|---|---|---|
| `status` | `text` notNull default `'pending'` | values: `pending` \| `approved` \| `rejected` |
| `rejectionReason` | `text` nullable | populated when `status = 'rejected'` |
| `reviewedAt` | `timestamp` nullable | set when an admin approves or rejects |
| `reviewedBy` | `text` nullable | Clerk user id of the admin who reviewed |

**Migration:** the generated migration must backfill every existing `ads` row to
`status = 'approved'` so currently-live ads keep serving after deploy.

## Ad Serving Change

`src/libs/ads.ts` (`selectAds`) currently filters ads on `active = true` plus keyword
match. Add `status = 'approved'` to the WHERE clause. Only `approved` + `active` ads
are ever served to searchers. `pending` and `rejected` ads are never served.

## Advertiser Wizard Impact

When an advertiser publishes an ad (`createAd`), the ad is created with the schema
default `status = 'pending'`. `updateAd` does not change `status` — editing an
approved ad leaves it approved; editing a rejected ad leaves it rejected (a future
phase could reset edited ads to pending, but that is out of scope here).

The advertiser ads-list page (`/advertise/ads`) shows four possible status badges,
derived from `status` + `active`:

- Pending review — `status = 'pending'` (yellow)
- Approved & Active — `status = 'approved'` and `active = true` (green)
- Approved & Paused — `status = 'approved'` and `active = false` (orange)
- Rejected — `status = 'rejected'` (red; rejection reason shown on hover/title)

## Pages

### `/admin/dashboard` (server component)
Four stat cards:
- Total advertisers (count of `advertisers`)
- Total ads, with a `pending / approved / rejected` breakdown
- Clicks in the last 30 days (count of `ad_clicks` where `clickedAt` within 30 days)
- Bid revenue in the last 30 days — sum over clicks in range of the clicked ad's
  `bidAmount`, displayed in pounds (`£{pence / 100}`)

When the pending count is greater than zero, a banner links to the queue:
"N ads awaiting review →".

### `/admin/queue` (server component + client action buttons)
Lists every `pending` ad, oldest first. Each row shows a full ad preview: title,
displayUrl, description, CTA text, keywords, bid (£), and advertiser name — enough
to judge the ad without leaving the page.

Two actions per ad:
- **Approve** — single click, calls `approveAd(id)`.
- **Reject** — reveals an inline reason textarea; confirming calls `rejectAd(id, reason)`.

Empty state: "No ads awaiting review".

### `/admin/ads` (server component + client action buttons)
Table of all ads. Columns: title, advertiser, status badge, bid (£), clicks, created
date. A status filter dropdown (all / pending / approved / rejected / paused) controls
which rows show; the filter is read from a search param.

Per-row action: **Suspend** when the ad is `approved` + `active` (sets `active=false`),
or **Unsuspend** when the ad is `approved` + not `active` (sets `active=true`).
Pending/rejected ads have no suspend action.

### `/admin/advertisers` (server component, read-only)
Table. Columns: name, email, number of ads, total clicks across their ads, joined
date, and a [View] link to the detail page.

### `/admin/advertisers/[id]` (server component, read-only)
Advertiser profile (name, email, joined date) followed by a list of all their ads
with status badges. `notFound()` if the id does not exist.

### `(admin)` layout
Renders the admin nav — links to Dashboard, Queue, Ads, Advertisers — plus the Clerk
`<UserButton />`. Calls `requireAdmin()` before rendering children.

## Auth Helper — `src/libs/admin.ts`

- `isAdminEmail(email)` — returns true if `email` is in the `ADMIN_EMAILS` list.
  Handles an empty/unset env var (returns false).
- `getAdminUser()` — returns the current Clerk user if signed in and an admin, else
  `null`.
- `requireAdmin()` — returns the admin Clerk user, or `redirect()`s to the advertiser
  sign-in route if the caller is not an admin. Used by the layout and pages.

## Server Actions — `src/libs/adminActions.ts`

All actions begin with `'use server'`, call `requireAdmin()` first, and wrap
`revalidatePath` in try/catch (it throws outside the Next.js runtime, matching the
existing Phase 2 actions). An action targeting a non-existent ad id is a no-op.

- `approveAd(id)` — sets `status='approved'`, `reviewedAt=now`, `reviewedBy=adminId`;
  revalidates the queue and ads paths.
- `rejectAd(id, reason)` — Zod-validates `reason` (string, 1–300 chars); sets
  `status='rejected'`, `rejectionReason=reason`, `reviewedAt=now`, `reviewedBy=adminId`;
  revalidates.
- `suspendAd(id)` — sets `active=false`; revalidates.
- `unsuspendAd(id)` — sets `active=true`; revalidates.

## Testing

Unit tests with a real PGLite database and a mocked Clerk client, following the
Phase 2 pattern.

`src/libs/admin.test.ts`:
- `isAdminEmail` matches an allowlisted email and rejects a non-listed one
- `isAdminEmail` returns false when `ADMIN_EMAILS` is empty/unset

`src/libs/adminActions.test.ts`:
- `approveAd` sets `status='approved'` and the audit fields (`reviewedAt`, `reviewedBy`)
- `rejectAd` sets `status='rejected'` with the reason and audit fields
- `rejectAd` refuses an empty reason and a reason longer than 300 chars
- `suspendAd` sets `active=false`; `unsuspendAd` sets `active=true`
- A non-admin Clerk user calling any admin action is refused
- An action on a non-existent ad id is a no-op (no throw)

`src/libs/ads.test.ts` (extend existing coverage):
- `selectAds` includes an `approved` + `active` ad
- `selectAds` excludes a `pending` ad and a `rejected` ad

## Error Handling

- `revalidatePath` calls are wrapped in try/catch.
- Admin actions on a missing ad id are no-ops, not errors.
- Non-admin access to any `/admin` route or action redirects to sign-in.
