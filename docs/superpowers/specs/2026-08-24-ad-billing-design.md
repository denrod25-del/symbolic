# Ad Billing Design (Phase 5)

**Date:** 2026-08-24
**Status:** Approved

## Goal

Let the Symbolic ad platform take money. Advertisers prepay a balance by card,
each ad click deducts their bid, and ads stop serving when the balance reaches
zero. Every movement is recorded in an append-only ledger.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Billing model | Prepaid balance (wallet) | Fits the existing per-click bid model; no debt, no dunning, no collections; advertiser cannot overspend |
| Currency | **USD** (migrated from GBP display) | US-based operator and advertisers; fix before real money moves |
| Top-up amounts | $25 / $50 / $100 presets + custom, min $10, max $500 | Below $10, Stripe's 2.9% + $0.30 eats roughly 9% |
| Debit timing | Synchronous at click time, with ledger | Accurate and immediate; one extra write on a request that already writes |
| Payment confirmation | Stripe webhook is source of truth | An interrupted redirect must never mean "money taken, balance not credited" |

## Scope

**In scope:**

- `balanceCents` on advertisers; `billing_transactions` append-only ledger
- Top-up via Stripe Checkout (hosted); webhook credits the balance
- Click charges deducted at click time
- `selectAds` gates on positive balance
- `/advertise/billing` page: balance, top-up, transaction history
- Low-balance and out-of-funds states in the dashboard and ads list
- Balance column in the admin advertisers list
- Currency migration GBP to USD via a shared `formatUsd` helper

**Out of scope (deferred):**

- Auto-recharge / saved cards (that is most of postpaid's complexity)
- Emailed receipts (needs an email provider wired up)
- Admin-issued refunds and credits (schema supports it via `kind: 'adjustment'`)
- Impression billing, daily budgets, per-campaign spend caps

## Data model

`advertisers` gains:

| Column | Type | Notes |
|---|---|---|
| `balanceCents` | integer notNull default 0 | Cached; always derivable from the ledger |

New table `billing_transactions` (append-only; never updated or deleted):

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `advertiserId` | integer FK to advertisers.id, notNull | |
| `kind` | text notNull | `topup` / `click_charge` / `adjustment` |
| `amountCents` | integer notNull | Signed: `+2500` top-up, `-50` click |
| `balanceAfterCents` | integer notNull | Snapshot for audit and drift detection |
| `adId` | integer FK to ads.id, nullable | Set on `click_charge` |
| `stripeSessionId` | text nullable, **unique** | Set on `topup`; the idempotency key |
| `description` | text notNull | Human-readable, e.g. "Top-up" |
| `createdAt` | timestamp notNull default now | |

All money is integer cents. No floats. `ads.bidAmount` is already integer minor
units and does not change; only its display symbol changes.

## Payment flow

**Top-up**

1. Advertiser picks a preset or custom amount on `/advertise/billing`
2. `createTopUpSession(amountCents)` server action validates the amount
   (minimum 1000 cents, maximum 50000 cents) and creates a Stripe Checkout
   Session, extending the existing provider pattern in `src/libs/payments.ts`
   (raw `fetch`, form-encoded, no SDK dependency)
3. Session carries `client_reference_id` = advertiser id,
   `metadata.advertiser_id`, `success_url` = `/advertise/billing?topup=pending`,
   `cancel_url` = `/advertise/billing`
4. Advertiser pays on Stripe's hosted page; card data never touches our server
5. Stripe POSTs `checkout.session.completed` to `/api/stripe/webhook`

**Webhook** — `src/app/api/stripe/webhook/route.ts`

- Verifies the `Stripe-Signature` header via HMAC-SHA256 over
  `timestamp + "." + rawBody` against `STRIPE_WEBHOOK_SECRET`, with a 5-minute
  timestamp tolerance. Invalid signature returns 400 and writes nothing.
- Reads the **raw body** with `await request.text()`. Parsing and reserializing
  the JSON breaks signature verification.
- Handles only `checkout.session.completed` where `payment_status` is `paid`.
  Every other event returns 200 and does nothing.
- Credits in one DB transaction: insert the `topup` ledger row (carrying
  `stripeSessionId`), then increment `advertisers.balanceCents`.
- A duplicate `stripeSessionId` (a Stripe retry) violates the unique index;
  swallow it and return 200. The balance is credited exactly once.
- Unknown advertiser: log, return 200, write nothing.

**Click charge** — `src/app/api/ads/click/route.ts` (already exists)

- In one DB transaction: insert a `click_charge` row for `-ad.bidAmount` and
  decrement `advertisers.balanceCents`.
- **The 307 redirect happens regardless.** A billing failure is logged and the
  click goes unbilled; it never blocks the visitor.

**Serving gate**

- `selectAds` joins `advertisers` and adds `balanceCents > 0` to the existing
  `status = 'approved'` and `active = true` conditions. No separate pause job
  and no state to keep in sync.

## UI

**`/advertise/billing`** (new page; "Billing" added to the portal nav)

- Balance card: large amount; amber under $5; red at $0 with the text
  "Your ads are paused - add funds to resume."
- Top-up row: `$25`, `$50`, `$100` buttons plus a custom-amount input
- When the URL carries `?topup=pending`: "Payment received - your balance will
  update in a few seconds", with a Refresh button. Honest about webhook latency
  rather than pretending the credit is instant.
- Transaction history table: date, description, signed amount (green positive,
  red negative), balance after. 50 most recent, newest first. Empty state before
  any activity.

**Advertiser dashboard** — a balance stat alongside the existing ones, plus a
warning banner under $5 or at $0 linking to the billing page.

**Ads list** — at zero balance the status badges show a "Paused - no funds"
treatment, so it is clear why nothing is serving.

**Admin advertisers list** — a read-only Balance column.

**All amounts** render through a single `formatUsd(cents)` helper in
`src/utils/Money.ts`, replacing the scattered `(x / 100).toFixed(2)` calls.

## Error handling

| Failure | Behaviour |
|---|---|
| Stripe API down when creating a session | Action returns an error object; the page shows "Couldn't start checkout." No money moved. |
| Advertiser abandons checkout | Nothing written |
| Invalid webhook signature | 400, nothing written (blocks forged credit) |
| Stripe retries a webhook | Unique `stripeSessionId` rejects the duplicate; return 200 |
| Webhook for an unknown advertiser | Log, return 200, no write |
| Click-charge write fails | Visitor still redirected; error logged; click unbilled |
| Concurrent clicks dip the balance negative | Accepted; maximum exposure is one bid; serving stops immediately after |
| `STRIPE_SECRET_KEY` unset | The existing stub provider returns a simulated link, so local dev works without Stripe |

## Testing

Real PGLite with mocked `fetch`, matching every prior phase.

- `billing.test.ts` — ledger insert and balance update are atomic;
  `balanceAfterCents` is correct; a duplicate `stripeSessionId` is rejected;
  the cached balance equals the sum of ledger amounts
- `stripeWebhook.test.ts` — a valid signature credits once; an **invalid
  signature credits nothing**; a replayed event credits once, not twice;
  non-completed and unpaid events are ignored
- `adClick` — a click both records and charges; a charge failure still redirects
- `ads.test.ts` — extend: a zero-balance advertiser's approved and active ad
  does not serve
- `Money.test.ts` — `formatUsd` for cents, zero, negative, and thousands

## Ops and manual setup

1. Stripe account, then an API key (start with `sk_test_...`)
2. Stripe dashboard, Webhooks, add endpoint
   `https://bsymbolic.com/api/stripe/webhook` for `checkout.session.completed`,
   then copy the signing secret
3. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to the VPS `.env.local`,
   rebuild, restart
4. Apply the new migration (the deploy workflow runs migrations automatically)
5. Verify in Stripe **test mode** with card `4242 4242 4242 4242` before going
   live

## Implementation split

Two plans come from this one spec:

- **Plan A, currency migration:** the `formatUsd` helper plus the six GBP
  display sites. Small, independent, ships on its own.
- **Plan B, billing system:** schema, ledger, Stripe session, webhook, click
  charging, serving gate, billing page, dashboard and admin surfaces.

Plan A lands first so the display change is not tangled up with payment logic
during review.
