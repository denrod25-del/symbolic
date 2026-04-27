# Advertiser Auth — Design Spec

**Date:** 2026-04-26
**Status:** Approved
**Phase:** 1 of 4 (auth → ad management → stripe billing → analytics)

---

## Overview

Add a self-serve advertiser portal to Symbolic at `/advertise/*`. Advertisers sign up with email and password via Clerk, verify their email, and land on a skeleton dashboard. A local `advertisers` DB row is created on first sign-in, linking Clerk's identity to the Postgres database.

---

## Decisions

| Question | Decision |
|---|---|
| Portal location | `/advertise/*` on same site (no subdomain) |
| Auth provider | Clerk (hosted, pre-built UI components) |
| Sign-in methods | Email + password only |
| Post-signup flow | Instant access after Clerk email verification |
| DB strategy | Clerk + local `advertisers` table (sync on first login) |

---

## Data Model

### New table: `advertisers`

```sql
CREATE TABLE advertisers (
  id           SERIAL PRIMARY KEY,
  clerk_user_id TEXT NOT NULL UNIQUE,
  email        TEXT NOT NULL,
  name         TEXT NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Modified table: `ads`

Add nullable foreign key:

```sql
ALTER TABLE ads ADD COLUMN advertiser_id INTEGER REFERENCES advertisers(id);
```

Existing seeded ads have `advertiser_id = NULL` (owned by no one). All ads created via the portal have a non-null `advertiser_id`.

---

## Routes

| Route | Access | Description |
|---|---|---|
| `/advertise/sign-in` | Public | Clerk `<SignIn />` component |
| `/advertise/sign-up` | Public | Clerk `<SignUp />` component |
| `/advertise/dashboard` | Protected | Skeleton dashboard, first page after login |

All `/advertise/*` routes except sign-in and sign-up are protected by Clerk middleware. Unauthenticated requests redirect to `/advertise/sign-in`.

---

## Architecture

### Middleware (`middleware.ts`)

Clerk's `clerkMiddleware()` protects `/advertise/*` routes. Sign-in and sign-up pages are public. All other `/advertise/*` routes require an active Clerk session.

### DB sync on first login (`src/libs/advertisers.ts`)

A server-side function `ensureAdvertiser(clerkUserId, email, name)` runs on first access to any protected portal route. It upserts an `advertisers` row — creating it if absent, doing nothing if it already exists (idempotent). Called from the dashboard layout server component.

### Pages

**`/advertise/sign-in`** — renders Clerk `<SignIn />` with `afterSignInUrl="/advertise/dashboard"`.

**`/advertise/sign-up`** — renders Clerk `<SignUp />` with `afterSignUpUrl="/advertise/dashboard"`.

**`/advertise/dashboard`** — server component. Calls `ensureAdvertiser()`, then renders a welcome card with:
- Advertiser's name from Clerk session
- "Active ads" count (queried from `ads` table, filtered by `advertiser_id`)
- "Budget" (£0 — placeholder for Phase 3 Stripe billing)
- "Create your first ad" CTA button (disabled/greyed until Phase 2)

### Layout (`/advertise/layout.tsx`)

Shared layout for all portal pages. Renders a minimal dark nav with the Symbolic logo, "Symbolic Ads" label, and a Clerk `<UserButton />` (account menu + sign-out) for authenticated routes.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Duplicate email sign-up | Clerk displays "email already in use" inline |
| Unverified email sign-in | Clerk blocks login and prompts for verification |
| `ensureAdvertiser` DB failure | Log error, return 500 with generic message; retry on refresh |
| Unauthenticated `/advertise/dashboard` access | Middleware redirects to `/advertise/sign-in` |

---

## Testing

One unit test: `ensureAdvertiser` is idempotent — calling it twice with the same `clerkUserId` creates exactly one DB row.

No tests for Clerk components (they are a third-party library).

---

## Environment Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/advertise/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/advertise/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/advertise/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/advertise/dashboard
```

These must be added to `.env.local` for dev and to the VPS `.env.local` for production.

---

## Out of Scope (future phases)

- Ad creation / campaign management (Phase 2)
- Stripe billing / CPC wallet (Phase 3)
- Analytics dashboard — impressions, clicks, spend (Phase 4)
- Admin view of all advertisers
- Password reset (handled automatically by Clerk)
