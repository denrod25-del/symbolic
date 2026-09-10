# Ad Billing System (Phase 5, Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Advertisers prepay a balance via Stripe Checkout, each ad click deducts their bid through an append-only ledger, and ads stop serving at zero balance.

**Architecture:** `advertisers.balanceCents` is a cached figure always derivable from a new append-only `billing_transactions` ledger. Top-ups go through Stripe's hosted Checkout; a signature-verified webhook is the sole source of truth for crediting. Clicks debit synchronously inside the existing click route. `selectAds` gates on a positive balance.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM (PostgreSQL/PGLite), Stripe REST API via raw `fetch` (no SDK), Node `crypto` for webhook signature verification, Clerk, next-intl, Vitest.

**Depends on:** Plan A (currency migration) — this plan uses `formatUsd` from `src/utils/Money.ts`.

---

## Environment notes for the implementer

- `bun` is NOT installed. Use `./node_modules/.bin/tsc --noEmit`,
  `./node_modules/.bin/vitest run <file>`, `npx ultracite check --type-aware --type-check`.
- **The Bash tool's cwd resets between commands** — start every command with
  `cd /c/Users/skyea/claude/symbolic &&`.
- DB tests need PGLite running: `npx pglite-server -m 100 --db=local.db` in the
  background, then `npx dotenv -c -- drizzle-kit migrate`. If `local.db` has a
  stale `postmaster.pid` causing a WASM abort, delete `local.db` and re-migrate.
- `npm run db:generate` must be run from **Git Bash** — drizzle-kit's prompts
  break under PowerShell.
- Lint rules that bite (learned the hard way in earlier phases): no `.then`
  chains (use async/await); no nested ternaries (extract a helper);
  `no-unsafe-type-assertion` (use type guards or a narrow eslint-disable);
  `require-await` and `promise-function-async` can contradict each other — if
  they do, make the function fully synchronous and return plain values, since
  `await` works on non-promises. `ultracite` reformats via a pre-commit hook.
- All money is **integer cents**. Never use floats for money anywhere.

## File map

| File | Action | Purpose |
|---|---|---|
| `src/models/Schema.ts` | Modify | `balanceCents` column, `billingTransactions` table |
| `migrations/00XX_*.sql` | Create (generated) | The above |
| `src/libs/Env.ts`, `.env` | Modify | `STRIPE_WEBHOOK_SECRET` |
| `src/libs/billing.ts` | Create | Ledger writes: credit, charge, read balance/history |
| `src/libs/billing.test.ts` | Create | Ledger atomicity, idempotency, balance integrity |
| `src/libs/payments.ts` | Modify | Add `createTopUpLink` to the existing provider pattern |
| `src/libs/billingActions.ts` | Create | `'use server'`: `createTopUpSession` |
| `src/libs/stripeWebhook.ts` | Create | Signature verification (pure, testable) |
| `src/libs/stripeWebhook.test.ts` | Create | Signature tests |
| `src/app/api/stripe/webhook/route.ts` | Create | The webhook endpoint |
| `src/app/api/ads/click/route.ts` | Modify | Charge on click |
| `src/libs/ads.ts` | Modify | Gate `selectAds` on balance |
| `src/libs/ads.test.ts` | Modify | Zero-balance ad does not serve |
| `src/app/[locale]/(portal)/advertise/billing/page.tsx` | Create | Billing page |
| `src/app/[locale]/(portal)/advertise/billing/TopUpButtons.tsx` | Create | Client top-up UI |
| `src/app/[locale]/(portal)/advertise/layout.tsx` | Modify | "Billing" nav link |
| `src/app/[locale]/(portal)/advertise/dashboard/page.tsx` | Modify | Balance stat + warning |
| `src/app/[locale]/(admin)/admin/advertisers/page.tsx` | Modify | Balance column |
| `src/locales/en.json`, `fr.json` | Modify | `BillingPage` namespace + nav/dashboard keys |

---

## Task 1: Schema, migration, and env

**Files:**
- Modify: `src/models/Schema.ts`
- Modify: `src/libs/Env.ts`, `.env`
- Create: `migrations/00XX_*.sql` (generated)

- [ ] **Step 1: Add the balance column**

In `src/models/Schema.ts`, the `advertisers` table currently ends with
`createdAt`. Add one column so it reads:

```ts
export const advertisers = pgTable('advertisers', {
  id: serial('id').primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  balanceCents: integer('balance_cents').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Add the ledger table**

Append to `src/models/Schema.ts`:

```ts
// Append-only money ledger. Rows are never updated or deleted; the cached
// advertisers.balanceCents is always derivable from SUM(amount_cents).
export const billingTransactions = pgTable('billing_transactions', {
  id: serial('id').primaryKey(),
  advertiserId: integer('advertiser_id')
    .notNull()
    .references(() => advertisers.id),
  kind: text('kind').notNull(),
  amountCents: integer('amount_cents').notNull(),
  balanceAfterCents: integer('balance_after_cents').notNull(),
  adId: integer('ad_id').references(() => ads.id),
  stripeSessionId: text('stripe_session_id').unique(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

- [ ] **Step 3: Generate and apply the migration**

Run from **Git Bash**:

```bash
cd /c/Users/skyea/claude/symbolic && npm run db:generate
```

Expected: a new `migrations/00XX_<name>.sql` containing `ALTER TABLE "advertisers" ADD COLUMN "balance_cents"` and `CREATE TABLE "billing_transactions"`. No manual edits needed — the new column has a default, so existing rows are fine.

Apply it (PGLite server must be running):

```bash
cd /c/Users/skyea/claude/symbolic && npx dotenv -c -- drizzle-kit migrate
```

Expected: `migrations applied successfully!`

- [ ] **Step 4: Add the webhook secret env var**

In `src/libs/Env.ts`, add to the `server` block (next to the existing
`STRIPE_SECRET_KEY`):

```ts
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
```

and to `runtimeEnv`:

```ts
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
```

Append to `.env`:

```
# Stripe webhook signing secret (whsec_...). Real value in .env.local / production.
STRIPE_WEBHOOK_SECRET=whsec_dev_placeholder
```

- [ ] **Step 5: Type-check and commit**

```bash
cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/tsc --noEmit
```

Expected: no output.

```bash
cd /c/Users/skyea/claude/symbolic && git add src/models/Schema.ts migrations/ src/libs/Env.ts .env && git commit -m "feat: add billing ledger schema and webhook secret"
```

---

## Task 2: The billing ledger library (TDD)

**Files:**
- Create: `src/libs/billing.ts`
- Create: `src/libs/billing.test.ts`

This is the heart of the system. Every money movement goes through here.

- [ ] **Step 1: Write the failing test**

Create `src/libs/billing.test.ts`:

```ts
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { advertisers, billingTransactions } from '@/models/Schema';
import {
  chargeForClick,
  creditTopUp,
  getBalanceCents,
  listTransactions,
} from './billing';
import { db } from './DB';

describe('billing', () => {
  let advertiserId: number;

  beforeEach(async () => {
    const [row] = await db
      .insert(advertisers)
      .values({
        clerkUserId: `billing_test_${crypto.randomUUID()}`,
        email: 'billing@example.com',
        name: 'Billing Test',
      })
      .returning();
    advertiserId = row!.id;
  });

  afterEach(async () => {
    await db
      .delete(billingTransactions)
      .where(eq(billingTransactions.advertiserId, advertiserId));
    await db.delete(advertisers).where(eq(advertisers.id, advertiserId));
  });

  describe('creditTopUp', () => {
    it('increases the balance and writes a ledger row', async () => {
      await creditTopUp({
        advertiserId,
        amountCents: 2500,
        stripeSessionId: `cs_test_${crypto.randomUUID()}`,
      });

      expect(await getBalanceCents(advertiserId)).toBe(2500);

      const rows = await listTransactions(advertiserId, 10);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.kind).toBe('topup');
      expect(rows[0]?.amountCents).toBe(2500);
      expect(rows[0]?.balanceAfterCents).toBe(2500);
    });

    it('accumulates across multiple top-ups', async () => {
      await creditTopUp({
        advertiserId,
        amountCents: 2500,
        stripeSessionId: `cs_a_${crypto.randomUUID()}`,
      });
      await creditTopUp({
        advertiserId,
        amountCents: 1000,
        stripeSessionId: `cs_b_${crypto.randomUUID()}`,
      });

      expect(await getBalanceCents(advertiserId)).toBe(3500);
    });

    it('ignores a duplicate stripe session id', async () => {
      const sessionId = `cs_dup_${crypto.randomUUID()}`;

      const first = await creditTopUp({
        advertiserId,
        amountCents: 2500,
        stripeSessionId: sessionId,
      });
      const second = await creditTopUp({
        advertiserId,
        amountCents: 2500,
        stripeSessionId: sessionId,
      });

      expect(first).toBe('credited');
      expect(second).toBe('duplicate');
      expect(await getBalanceCents(advertiserId)).toBe(2500);
      expect(await listTransactions(advertiserId, 10)).toHaveLength(1);
    });
  });

  describe('chargeForClick', () => {
    it('decreases the balance and records a negative amount', async () => {
      await creditTopUp({
        advertiserId,
        amountCents: 1000,
        stripeSessionId: `cs_c_${crypto.randomUUID()}`,
      });

      await chargeForClick({
        advertiserId,
        amountCents: 50,
        adId: null,
        description: 'Click on Test ad',
      });

      expect(await getBalanceCents(advertiserId)).toBe(950);

      const rows = await listTransactions(advertiserId, 10);
      expect(rows[0]?.kind).toBe('click_charge');
      expect(rows[0]?.amountCents).toBe(-50);
      expect(rows[0]?.balanceAfterCents).toBe(950);
    });
  });

  it('keeps the cached balance equal to the ledger sum', async () => {
    await creditTopUp({
      advertiserId,
      amountCents: 2500,
      stripeSessionId: `cs_d_${crypto.randomUUID()}`,
    });
    await chargeForClick({
      advertiserId,
      amountCents: 50,
      adId: null,
      description: 'Click',
    });
    await chargeForClick({
      advertiserId,
      amountCents: 75,
      adId: null,
      description: 'Click',
    });

    const [summed] = await db
      .select({ total: sql<number>`coalesce(sum(${billingTransactions.amountCents}), 0)`.mapWith(Number) })
      .from(billingTransactions)
      .where(eq(billingTransactions.advertiserId, advertiserId));

    expect(await getBalanceCents(advertiserId)).toBe(summed?.total);
    expect(summed?.total).toBe(2375);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/vitest run src/libs/billing.test.ts`
Expected: FAIL — cannot find module `./billing`.

- [ ] **Step 3: Write the implementation**

Create `src/libs/billing.ts`:

```ts
import { desc, eq, sql } from 'drizzle-orm';
import { advertisers, billingTransactions } from '@/models/Schema';
import { db } from './DB';

export type CreditTopUpInput = {
  advertiserId: number;
  amountCents: number;
  stripeSessionId: string;
};

export type ChargeForClickInput = {
  advertiserId: number;
  amountCents: number;
  adId: number | null;
  description: string;
};

export type CreditResult = 'credited' | 'duplicate';

/**
 * Returns an advertiser's cached balance in cents.
 * @param advertiserId - The advertiser's database ID.
 * @returns The balance in cents, or 0 when the advertiser is unknown.
 */
export async function getBalanceCents(advertiserId: number): Promise<number> {
  const [row] = await db
    .select({ balance: advertisers.balanceCents })
    .from(advertisers)
    .where(eq(advertisers.id, advertiserId))
    .limit(1);
  return row?.balance ?? 0;
}

/**
 * Returns an advertiser's most recent ledger entries, newest first.
 * @param advertiserId - The advertiser's database ID.
 * @param limit - Maximum rows to return.
 * @returns The matching ledger rows.
 */
export function listTransactions(advertiserId: number, limit: number) {
  return db
    .select()
    .from(billingTransactions)
    .where(eq(billingTransactions.advertiserId, advertiserId))
    .orderBy(desc(billingTransactions.createdAt), desc(billingTransactions.id))
    .limit(limit);
}

/**
 * Credits a completed Stripe top-up, keyed by session ID so that Stripe's
 * webhook retries cannot double-credit.
 * @param input - The advertiser, amount, and Stripe session ID.
 * @returns `credited` on success, or `duplicate` when the session was already applied.
 */
export async function creditTopUp(
  input: CreditTopUpInput
): Promise<CreditResult> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(advertisers)
      .set({
        balanceCents: sql`${advertisers.balanceCents} + ${input.amountCents}`,
      })
      .where(eq(advertisers.id, input.advertiserId))
      .returning({ balance: advertisers.balanceCents });

    if (!updated) {
      throw new Error(`Unknown advertiser ${input.advertiserId}`);
    }

    const inserted = await tx
      .insert(billingTransactions)
      .values({
        advertiserId: input.advertiserId,
        kind: 'topup',
        amountCents: input.amountCents,
        balanceAfterCents: updated.balance,
        stripeSessionId: input.stripeSessionId,
        description: 'Top-up',
      })
      .onConflictDoNothing({ target: billingTransactions.stripeSessionId })
      .returning({ id: billingTransactions.id });

    if (inserted.length === 0) {
      // Stripe replayed the webhook. Undo the balance bump and report it.
      tx.rollback();
    }

    return 'credited';
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message.includes('rollback')) {
      return 'duplicate' as const;
    }
    throw error;
  });
}

/**
 * Debits an advertiser for one ad click.
 * @param input - The advertiser, amount, ad, and description.
 * @returns Nothing; throws when the advertiser is unknown.
 */
export async function chargeForClick(
  input: ChargeForClickInput
): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(advertisers)
      .set({
        balanceCents: sql`${advertisers.balanceCents} - ${input.amountCents}`,
      })
      .where(eq(advertisers.id, input.advertiserId))
      .returning({ balance: advertisers.balanceCents });

    if (!updated) {
      throw new Error(`Unknown advertiser ${input.advertiserId}`);
    }

    await tx.insert(billingTransactions).values({
      advertiserId: input.advertiserId,
      kind: 'click_charge',
      amountCents: -input.amountCents,
      balanceAfterCents: updated.balance,
      adId: input.adId,
      description: input.description,
    });
  });
}
```

**Implementation note for the engineer:** Drizzle's `tx.rollback()` throws a
`TransactionRollbackError` to unwind the transaction. The `.catch` above turns
that into the `'duplicate'` return value. If the installed Drizzle version's
rollback error does not match `error.message.includes('rollback')`, inspect the
actual error (log `error.constructor.name` in a scratch run) and match on that
instead — the required behaviour is fixed by the tests: a duplicate session ID
must leave the balance unchanged and write no second row. An acceptable
alternative implementation is to check for an existing row with that
`stripeSessionId` *before* touching the balance, and return `'duplicate'`
early; the unique index still protects against the race.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/vitest run src/libs/billing.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Type-check, lint, commit**

```bash
cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/tsc --noEmit && npx ultracite check --type-aware --type-check
```

If knip flags `billing.ts` exports as unused (consumers land in later tasks),
add `'src/libs/billing.ts'` to the `ignore` array in `knip.config.ts`.

```bash
cd /c/Users/skyea/claude/symbolic && git add src/libs/billing.ts src/libs/billing.test.ts knip.config.ts && git commit -m "feat: add billing ledger with idempotent top-up credit"
```

---

## Task 3: Stripe webhook signature verification (TDD)

**Files:**
- Create: `src/libs/stripeWebhook.ts`
- Create: `src/libs/stripeWebhook.test.ts`

Kept as a pure function so it is testable without HTTP.

- [ ] **Step 1: Write the failing test**

Create `src/libs/stripeWebhook.test.ts`:

```ts
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyStripeSignature } from './stripeWebhook';

const SECRET = 'whsec_test_secret';
const BODY = '{"id":"evt_1","type":"checkout.session.completed"}';

function sign(body: string, timestamp: number, secret = SECRET): string {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('verifyStripeSignature', () => {
  it('accepts a correctly signed recent payload', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeSignature({
        body: BODY,
        header: sign(BODY, now),
        secret: SECRET,
        nowSeconds: now,
      })
    ).toBe(true);
  });

  it('rejects a payload signed with the wrong secret', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeSignature({
        body: BODY,
        header: sign(BODY, now, 'whsec_wrong'),
        secret: SECRET,
        nowSeconds: now,
      })
    ).toBe(false);
  });

  it('rejects a tampered body', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeSignature({
        body: '{"id":"evt_evil"}',
        header: sign(BODY, now),
        secret: SECRET,
        nowSeconds: now,
      })
    ).toBe(false);
  });

  it('rejects a timestamp older than the tolerance', () => {
    const now = Math.floor(Date.now() / 1000);
    const old = now - 600;
    expect(
      verifyStripeSignature({
        body: BODY,
        header: sign(BODY, old),
        secret: SECRET,
        nowSeconds: now,
      })
    ).toBe(false);
  });

  it('rejects a malformed header', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeSignature({
        body: BODY,
        header: 'garbage',
        secret: SECRET,
        nowSeconds: now,
      })
    ).toBe(false);
  });

  it('rejects an empty secret', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeSignature({
        body: BODY,
        header: sign(BODY, now),
        secret: '',
        nowSeconds: now,
      })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/vitest run src/libs/stripeWebhook.test.ts`
Expected: FAIL — cannot find module `./stripeWebhook`.

- [ ] **Step 3: Write the implementation**

Create `src/libs/stripeWebhook.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 300;

export type VerifyInput = {
  body: string;
  header: string | null;
  secret: string;
  nowSeconds: number;
};

/**
 * Parses Stripe's `Stripe-Signature` header into its timestamp and v1 digests.
 * @param header - The raw header value.
 * @returns The timestamp and signatures, or null when malformed.
 */
function parseHeader(
  header: string
): { timestamp: number; signatures: string[] } | null {
  let timestamp = Number.NaN;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    if (key === 't' && value) {
      timestamp = Number(value);
    }
    if (key === 'v1' && value) {
      signatures.push(value);
    }
  }

  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    return null;
  }
  return { timestamp, signatures };
}

/**
 * Compares two hex digests without leaking timing information.
 * @param a - First hex digest.
 * @param b - Second hex digest.
 * @returns True when the digests match.
 */
function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length === 0 || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Verifies a Stripe webhook signature over the raw request body.
 * @param input - Raw body, signature header, signing secret, and current time.
 * @returns True when the payload is authentic and recent.
 */
export function verifyStripeSignature(input: VerifyInput): boolean {
  if (!(input.secret && input.header)) {
    return false;
  }

  const parsed = parseHeader(input.header);
  if (!parsed) {
    return false;
  }

  if (Math.abs(input.nowSeconds - parsed.timestamp) > TOLERANCE_SECONDS) {
    return false;
  }

  const expected = createHmac('sha256', input.secret)
    .update(`${parsed.timestamp}.${input.body}`)
    .digest('hex');

  return parsed.signatures.some((candidate) =>
    safeEqualHex(expected, candidate)
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/vitest run src/libs/stripeWebhook.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Type-check, lint, commit**

```bash
cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/tsc --noEmit && git add src/libs/stripeWebhook.ts src/libs/stripeWebhook.test.ts knip.config.ts && git commit -m "feat: add stripe webhook signature verification"
```

(Include `knip.config.ts` only if you had to add an ignore entry.)

---

## Task 4: Stripe Checkout session for top-ups

**Files:**
- Modify: `src/libs/payments.ts`
- Create: `src/libs/billingActions.ts`

- [ ] **Step 1: Add a top-up link creator to the payments library**

`src/libs/payments.ts` already has a `PaymentProvider` pattern with a `stub`
provider (used when `STRIPE_SECRET_KEY` is unset) and a `stripeProvider`, plus
helpers `appBaseUrl()` and `readString()`. Add a parallel top-up function at
the end of the file, reusing those helpers:

```ts
export type CreateTopUpInput = {
  advertiserId: number;
  amountCents: number;
};

export type CreateTopUpResult =
  | { status: 'created'; url: string }
  | { status: 'failed' };

/**
 * Creates a hosted Stripe Checkout session for an advertiser balance top-up.
 * Falls back to a simulated link when no Stripe key is configured.
 * @param input - The advertiser and amount in cents.
 * @returns The checkout URL, or a failed result.
 */
export async function createTopUpLink(
  input: CreateTopUpInput
): Promise<CreateTopUpResult> {
  const base = appBaseUrl();

  if (!Env.STRIPE_SECRET_KEY) {
    return {
      status: 'created',
      url: `${base}/en/advertise/billing?topup=simulated`,
    };
  }

  try {
    const response = await fetch(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          mode: 'payment',
          client_reference_id: String(input.advertiserId),
          'metadata[advertiser_id]': String(input.advertiserId),
          success_url: `${base}/en/advertise/billing?topup=pending`,
          cancel_url: `${base}/en/advertise/billing`,
          'line_items[0][quantity]': '1',
          'line_items[0][price_data][currency]': 'usd',
          'line_items[0][price_data][unit_amount]': String(input.amountCents),
          'line_items[0][price_data][product_data][name]':
            'Symbolic Ads balance top-up',
        }).toString(),
      }
    );

    if (!response.ok) {
      return { status: 'failed' };
    }

    const data: unknown = await response.json();
    const url = readString(data, 'url');
    return url ? { status: 'created', url } : { status: 'failed' };
  } catch {
    return { status: 'failed' };
  }
}
```

- [ ] **Step 2: Create the server action**

Create `src/libs/billingActions.ts`:

```ts
'use server';

import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { advertisers } from '@/models/Schema';
import { db } from './DB';
import { createTopUpLink } from './payments';

const MIN_TOPUP_CENTS = 1000;
const MAX_TOPUP_CENTS = 50_000;

/**
 * Starts a Stripe Checkout session to top up the signed-in advertiser's balance.
 * @param amountCents - The amount to add, in cents.
 * @returns The checkout URL to redirect to, or an error message.
 */
export async function createTopUpSession(
  amountCents: number
): Promise<{ url: string } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not signed in' };
  }

  if (
    !Number.isInteger(amountCents)
    || amountCents < MIN_TOPUP_CENTS
    || amountCents > MAX_TOPUP_CENTS
  ) {
    return { error: 'Enter an amount between $10 and $500' };
  }

  const [advertiser] = await db
    .select({ id: advertisers.id })
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, user.id))
    .limit(1);

  if (!advertiser) {
    return { error: 'Advertiser account not found' };
  }

  const result = await createTopUpLink({
    advertiserId: advertiser.id,
    amountCents,
  });

  if (result.status === 'failed') {
    return { error: "Couldn't start checkout" };
  }

  return { url: result.url };
}
```

- [ ] **Step 3: Type-check, lint, commit**

```bash
cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/tsc --noEmit && npx ultracite check --type-aware --type-check
```

Add `'src/libs/billingActions.ts'` to the `knip.config.ts` ignore list if knip
flags it (its consumer lands in Task 7).

```bash
cd /c/Users/skyea/claude/symbolic && git add src/libs/payments.ts src/libs/billingActions.ts knip.config.ts && git commit -m "feat: add stripe checkout session for balance top-ups"
```

---

## Task 5: The webhook endpoint

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { advertisers } from '@/models/Schema';
import { creditTopUp } from '@/libs/billing';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { verifyStripeSignature } from '@/libs/stripeWebhook';

type StripeSession = {
  id?: unknown;
  payment_status?: unknown;
  amount_total?: unknown;
  client_reference_id?: unknown;
};

type StripeEvent = {
  type?: unknown;
  data?: { object?: StripeSession };
};

export async function POST(request: Request) {
  // The raw body is required: reserializing the JSON breaks the signature.
  const body = await request.text();

  const valid = verifyStripeSignature({
    body,
    header: request.headers.get('stripe-signature'),
    secret: Env.STRIPE_WEBHOOK_SECRET ?? '',
    nowSeconds: Math.floor(Date.now() / 1000),
  });

  if (!valid) {
    return new NextResponse('Invalid signature', { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    return new NextResponse('Bad payload', { status: 400 });
  }

  // Acknowledge anything we do not act on so Stripe stops retrying.
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data?.object;
  if (!session || session.payment_status !== 'paid') {
    return NextResponse.json({ received: true });
  }

  const sessionId = typeof session.id === 'string' ? session.id : null;
  const amountCents =
    typeof session.amount_total === 'number' ? session.amount_total : null;
  const advertiserId =
    typeof session.client_reference_id === 'string'
      ? Number(session.client_reference_id)
      : Number.NaN;

  if (!(sessionId && amountCents) || !Number.isInteger(advertiserId)) {
    return NextResponse.json({ received: true });
  }

  const [advertiser] = await db
    .select({ id: advertisers.id })
    .from(advertisers)
    .where(eq(advertisers.id, advertiserId))
    .limit(1);

  if (!advertiser) {
    return NextResponse.json({ received: true });
  }

  await creditTopUp({ advertiserId, amountCents, stripeSessionId: sessionId });

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Confirm the route is reachable through middleware**

`src/middleware.ts` already passes `/api/*` straight through without the i18n
rewrite (added in an earlier fix), so no middleware change is needed. Verify by
reading the file and confirming the `req.nextUrl.pathname.startsWith('/api/')`
early return is present. If it is missing, stop and report — the webhook would
404 without it.

- [ ] **Step 3: Type-check, lint, commit**

```bash
cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/tsc --noEmit && git add src/app/api/stripe && git commit -m "feat: add stripe webhook endpoint for top-up credits"
```

---

## Task 6: Charge on click and gate serving

**Files:**
- Modify: `src/app/api/ads/click/route.ts`
- Modify: `src/libs/ads.ts`
- Modify: `src/libs/ads.test.ts`

- [ ] **Step 1: Add the zero-balance serving test first**

In `src/libs/ads.test.ts`, the existing `insertAd` helper creates ads for a
single advertiser created in `beforeEach`. Add this test inside the
`describe('selectAds', ...)` block:

```ts
  it('excludes an ad whose advertiser has no balance', async () => {
    await db
      .update(advertisers)
      .set({ balanceCents: 0 })
      .where(eq(advertisers.id, advertiserId));

    const id = await insertAd('approved', true);
    const result = await selectAds('running');
    expect(result.map((ad) => ad.id)).not.toContain(id);
  });

  it('includes an ad whose advertiser has a balance', async () => {
    await db
      .update(advertisers)
      .set({ balanceCents: 500 })
      .where(eq(advertisers.id, advertiserId));

    const id = await insertAd('approved', true);
    const result = await selectAds('running');
    expect(result.map((ad) => ad.id)).toContain(id);
  });
```

The existing tests in this file create advertisers without setting
`balanceCents`, so they default to `0` — which means **they will now fail**
once the gate is added. Fix them by setting a balance in the file's
`beforeEach`, immediately after the advertiser insert:

```ts
    await db
      .update(advertisers)
      .set({ balanceCents: 10_000 })
      .where(eq(advertisers.id, advertiserId));
```

Ensure `advertisers` and `eq` are imported in the test file.

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/vitest run src/libs/ads.test.ts`
Expected: the "excludes an ad whose advertiser has no balance" test FAILS
(the ad still serves, because no gate exists yet).

- [ ] **Step 3: Add the balance gate to `selectAds`**

In `src/libs/ads.ts`, `selectAds` currently selects from `ads` alone. Change it
to join `advertisers` and require a positive balance. Replace the whole
function body's query with:

```ts
  const result = await db
    .select()
    .from(ads)
    .innerJoin(advertisers, eq(ads.advertiserId, advertisers.id))
    .where(
      and(
        eq(ads.status, 'approved'),
        eq(ads.active, true),
        gt(advertisers.balanceCents, 0),
        sql`${ads.keywords} && ARRAY[${sql.join(
          tokens.map((t) => sql`${t}`),
          sql`, `
        )}]::text[]`
      )
    )
    .orderBy(desc(ads.bidAmount))
    .limit(2);

  return result.map((row) => row.ads);
```

Add `gt` to the `drizzle-orm` import and `advertisers` to the `@/models/Schema`
import. **The `.map((row) => row.ads)` is essential** — a join makes Drizzle
return `{ ads: ..., advertisers: ... }` per row, and every caller expects a
bare `Ad[]`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/vitest run src/libs/ads.test.ts`
Expected: PASS — all tests including the two new ones.

- [ ] **Step 5: Charge on click**

In `src/app/api/ads/click/route.ts`, replace the existing best-effort click
insert block:

```ts
  try {
    await db.insert(adClicks).values({ adId: ad.id, query });
  } catch {
    // Best-effort: record the click if possible, but don't block the redirect
  }
```

with a version that also charges:

```ts
  try {
    await db.insert(adClicks).values({ adId: ad.id, query });

    if (ad.advertiserId) {
      await chargeForClick({
        advertiserId: ad.advertiserId,
        amountCents: ad.bidAmount,
        adId: ad.id,
        description: `Click on "${ad.title}"`,
      });
    }
  } catch {
    // Best-effort: never block the visitor's redirect on a billing failure.
  }
```

Add `import { chargeForClick } from '@/libs/billing';` to the imports.

- [ ] **Step 6: Full suite, then commit**

```bash
cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

Expected: all tests pass.

```bash
cd /c/Users/skyea/claude/symbolic && git add src/libs/ads.ts src/libs/ads.test.ts src/app/api/ads/click && git commit -m "feat: charge advertisers per click and gate serving on balance"
```

---

## Task 7: i18n keys and the billing page

**Files:**
- Modify: `src/locales/en.json`, `src/locales/fr.json`
- Create: `src/app/[locale]/(portal)/advertise/billing/TopUpButtons.tsx`
- Create: `src/app/[locale]/(portal)/advertise/billing/page.tsx`
- Modify: `src/app/[locale]/(portal)/advertise/layout.tsx`

- [ ] **Step 1: Add English keys**

In `src/locales/en.json`, add a `BillingPage` namespace immediately after the
`AdsPage` namespace:

```json
  "BillingPage": {
    "title": "Billing",
    "balance_label": "Current balance",
    "low_balance": "Your balance is running low.",
    "no_funds": "Your ads are paused - add funds to resume.",
    "topup_title": "Add funds",
    "topup_custom_placeholder": "Custom amount",
    "topup_button": "Add funds",
    "topup_pending": "Payment received - your balance will update in a few seconds.",
    "topup_simulated": "Simulated top-up (no Stripe key configured).",
    "refresh": "Refresh",
    "history_title": "Transaction history",
    "history_empty": "No transactions yet.",
    "col_date": "Date",
    "col_description": "Description",
    "col_amount": "Amount",
    "col_balance": "Balance",
    "error_generic": "Couldn't start checkout."
  },
```

Also add `"nav_billing": "Billing"` to the existing `AdvertiseLayout` namespace.

- [ ] **Step 2: Add French keys**

Mirror into `src/locales/fr.json` in the same positions:

```json
  "BillingPage": {
    "title": "Facturation",
    "balance_label": "Solde actuel",
    "low_balance": "Votre solde est faible.",
    "no_funds": "Vos annonces sont en pause - ajoutez des fonds pour reprendre.",
    "topup_title": "Ajouter des fonds",
    "topup_custom_placeholder": "Montant personnalisé",
    "topup_button": "Ajouter des fonds",
    "topup_pending": "Paiement reçu - votre solde sera mis à jour dans quelques secondes.",
    "topup_simulated": "Rechargement simulé (aucune clé Stripe configurée).",
    "refresh": "Actualiser",
    "history_title": "Historique des transactions",
    "history_empty": "Aucune transaction pour le moment.",
    "col_date": "Date",
    "col_description": "Description",
    "col_amount": "Montant",
    "col_balance": "Solde",
    "error_generic": "Impossible de démarrer le paiement."
  },
```

and `"nav_billing": "Facturation"` in `AdvertiseLayout`.

- [ ] **Step 3: Create the top-up client component**

Create `src/app/[locale]/(portal)/advertise/billing/TopUpButtons.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { createTopUpSession } from '@/libs/billingActions';

const PRESETS_CENTS = [2500, 5000, 10_000];

export function TopUpButtons(props: {
  labels: { custom: string; submit: string; error: string };
}) {
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start(amountCents: number) {
    setBusy(true);
    setError('');
    const result = await createTopUpSession(amountCents);
    if ('error' in result) {
      setError(result.error);
      setBusy(false);
      return;
    }
    window.location.href = result.url;
  }

  const customCents = Math.round(Number(custom) * 100);
  const customValid = Number.isFinite(customCents) && customCents >= 1000;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS_CENTS.map((cents) => (
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            disabled={busy}
            key={cents}
            onClick={async () => {
              await start(cents);
            }}
            type="button"
          >
            ${cents / 100}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="w-40 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm"
          inputMode="decimal"
          onChange={(event) => {
            setCustom(event.target.value);
          }}
          placeholder={props.labels.custom}
          value={custom}
        />
        <button
          className="rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
          disabled={busy || !customValid}
          onClick={async () => {
            await start(customCents);
          }}
          type="button"
        >
          {props.labels.submit}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Create the billing page**

Create `src/app/[locale]/(portal)/advertise/billing/page.tsx`:

```tsx
import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { listTransactions } from '@/libs/billing';
import { db } from '@/libs/DB';
import { advertisers } from '@/models/Schema';
import { formatUsd } from '@/utils/Money';
import { TopUpButtons } from './TopUpButtons';

const LOW_BALANCE_CENTS = 500;

function balanceClass(balanceCents: number): string {
  if (balanceCents <= 0) {
    return 'text-red-400';
  }
  if (balanceCents < LOW_BALANCE_CENTS) {
    return 'text-amber-400';
  }
  return 'text-white';
}

export default async function BillingPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ topup?: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const { topup } = await props.searchParams;
  const t = await getTranslations('BillingPage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const [advertiser] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, user.id))
    .limit(1);

  if (!advertiser) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const transactions = await listTransactions(advertiser.id, 50);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>

      {topup === 'pending' && (
        <div className="mb-6 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {t('topup_pending')}{' '}
          <a className="underline" href={`/${locale}/advertise/billing`}>
            {t('refresh')}
          </a>
        </div>
      )}
      {topup === 'simulated' && (
        <div className="mb-6 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/60">
          {t('topup_simulated')}
        </div>
      )}

      <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-6">
        <div className="text-xs tracking-wide text-white/40 uppercase">
          {t('balance_label')}
        </div>
        <div
          className={`mt-1 text-4xl font-bold ${balanceClass(advertiser.balanceCents)}`}
        >
          {formatUsd(advertiser.balanceCents)}
        </div>
        {advertiser.balanceCents <= 0 && (
          <p className="mt-2 text-sm text-red-400">{t('no_funds')}</p>
        )}
        {advertiser.balanceCents > 0
          && advertiser.balanceCents < LOW_BALANCE_CENTS && (
            <p className="mt-2 text-sm text-amber-400">{t('low_balance')}</p>
          )}
      </div>

      <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 font-medium">{t('topup_title')}</h2>
        <TopUpButtons
          labels={{
            custom: t('topup_custom_placeholder'),
            submit: t('topup_button'),
            error: t('error_generic'),
          }}
        />
      </div>

      <h2 className="mb-4 font-medium">{t('history_title')}</h2>
      {transactions.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 px-6 py-12 text-center text-white/50">
          {t('history_empty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="grid grid-cols-[110px_1fr_100px_100px] gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold tracking-wide text-white/40 uppercase">
            <span>{t('col_date')}</span>
            <span>{t('col_description')}</span>
            <span>{t('col_amount')}</span>
            <span>{t('col_balance')}</span>
          </div>
          {transactions.map((row) => (
            <div
              className="grid grid-cols-[110px_1fr_100px_100px] items-center gap-4 border-b border-white/5 px-4 py-3 text-sm last:border-0"
              key={row.id}
            >
              <span className="text-xs text-white/50">
                {row.createdAt.toISOString().slice(0, 10)}
              </span>
              <span className="truncate">{row.description}</span>
              <span
                className={
                  row.amountCents >= 0 ? 'text-green-400' : 'text-red-400'
                }
              >
                {row.amountCents >= 0 ? '+' : ''}
                {formatUsd(row.amountCents)}
              </span>
              <span className="text-white/60">
                {formatUsd(row.balanceAfterCents)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add the nav link**

In `src/app/[locale]/(portal)/advertise/layout.tsx`, after the existing
"My ads" link, add:

```tsx
            <Link
              href={`/${locale}/advertise/billing`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_billing')}
            </Link>
```

- [ ] **Step 6: Protect the route**

In `src/middleware.ts`, add `'/:locale/advertise/billing(.*)'` to the
`createRouteMatcher` array so the page requires sign-in.

- [ ] **Step 7: Verify and commit**

```bash
cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/tsc --noEmit && npm run check:i18n && ./node_modules/.bin/vitest run
```

Expected: no type errors; "No missing keys found!"; all tests pass.

Remove any temporary `knip.config.ts` ignore entries for `billing.ts` and
`billingActions.ts` now that they have real consumers, and confirm
`npx knip` is happy.

```bash
cd /c/Users/skyea/claude/symbolic && git add "src/app/\[locale\]/\(portal\)/advertise" src/middleware.ts src/locales knip.config.ts && git commit -m "feat: add advertiser billing page with top-up and history"
```

---

## Task 8: Dashboard and admin surfaces

**Files:**
- Modify: `src/app/[locale]/(portal)/advertise/dashboard/page.tsx`
- Modify: `src/app/[locale]/(admin)/admin/advertisers/page.tsx`
- Modify: `src/locales/en.json`, `src/locales/fr.json`

- [ ] **Step 1: Add dashboard keys**

In `src/locales/en.json`, add to the `AdvertiseDashboardPage` namespace:

```json
    "balance_label": "Balance",
    "low_balance_warning": "Your balance is low - top up to keep your ads running.",
    "no_funds_warning": "Your ads are paused - you're out of funds.",
    "manage_billing": "Manage billing"
```

In `src/locales/fr.json`, the same keys:

```json
    "balance_label": "Solde",
    "low_balance_warning": "Votre solde est faible - rechargez pour que vos annonces continuent.",
    "no_funds_warning": "Vos annonces sont en pause - vous n'avez plus de fonds.",
    "manage_billing": "Gérer la facturation"
```

- [ ] **Step 2: Show balance and warnings on the advertiser dashboard**

Open `src/app/[locale]/(portal)/advertise/dashboard/page.tsx`. It already loads
the advertiser row and renders stat cards. Add these imports:

```tsx
import Link from 'next/link';
import { formatUsd } from '@/utils/Money';
```

(`Link` may already be imported — do not duplicate it.)

Add a balance stat card alongside the existing cards, using the advertiser's
`balanceCents`:

```tsx
      <div className="rounded-lg border border-white/10 bg-white/5 p-6">
        <div className="text-xs tracking-wide text-white/40 uppercase">
          {t('balance_label')}
        </div>
        <div className="mt-1 text-3xl font-bold">
          {formatUsd(advertiser?.balanceCents ?? 0)}
        </div>
      </div>
```

And immediately above the stat grid, a warning banner:

```tsx
      {(advertiser?.balanceCents ?? 0) <= 0 && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {t('no_funds_warning')}{' '}
          <Link className="underline" href={`/${locale}/advertise/billing`}>
            {t('manage_billing')}
          </Link>
        </div>
      )}
      {(advertiser?.balanceCents ?? 0) > 0
        && (advertiser?.balanceCents ?? 0) < 500 && (
          <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {t('low_balance_warning')}{' '}
            <Link className="underline" href={`/${locale}/advertise/billing`}>
              {t('manage_billing')}
            </Link>
          </div>
        )}
```

Adapt the variable name if the page calls the advertiser row something else —
read the file first and match what is there.

- [ ] **Step 3: Add a Balance column to the admin advertisers list**

In `src/app/[locale]/(admin)/admin/advertisers/page.tsx`:

- Add `import { formatUsd } from '@/utils/Money';`
- Add `"col_balance": "Balance"` to the `AdminAdvertisersPage` namespace in both
  locale files
- The table uses a `grid-cols-[1.5fr_2fr_60px_70px_110px_80px]` layout in both
  the header row and the body rows. Change **both** to
  `grid-cols-[1.5fr_2fr_60px_70px_90px_110px_80px]`, add a
  `<span>{t('col_balance')}</span>` header cell after the clicks header, and add
  a matching body cell after the clicks cell:

```tsx
              <span>{formatUsd(advertiser.balanceCents)}</span>
```

Both grids must have the same number of columns or the table will misalign.

- [ ] **Step 4: Verify and commit**

```bash
cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/tsc --noEmit && npm run check:i18n && ./node_modules/.bin/vitest run
```

```bash
cd /c/Users/skyea/claude/symbolic && git add "src/app/\[locale\]" src/locales && git commit -m "feat: surface advertiser balance in dashboard and admin list"
```

---

## Task 9: Ops documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a billing section**

```markdown
## Billing ops

Advertisers prepay a balance; each ad click deducts their bid. Money moves are
recorded in the append-only `billing_transactions` ledger, and
`advertisers.balance_cents` is a cached figure always equal to
`SUM(amount_cents)` for that advertiser.

Production env vars:

- `STRIPE_SECRET_KEY` - start with `sk_test_...` and verify the whole flow
  before switching to a live key
- `STRIPE_WEBHOOK_SECRET` - the `whsec_...` signing secret from the Stripe
  dashboard webhook endpoint

Stripe dashboard setup: add a webhook endpoint at
`https://bsymbolic.com/api/stripe/webhook` subscribed to
`checkout.session.completed`.

Test the flow in Stripe test mode with card `4242 4242 4242 4242`, any future
expiry, any CVC. Confirm the balance credits within a few seconds of paying and
that a second webhook delivery (Stripe dashboard, "Resend") does not
double-credit.

With no `STRIPE_SECRET_KEY` set, top-ups fall back to a simulated link and no
money moves - useful for local development.
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/skyea/claude/symbolic && git add README.md && git commit -m "docs: add billing ops notes"
```

---

## Done

Advertisers can fund a balance, clicks bill against it, and ads stop when the
money runs out — with a ledger that can prove every cent.

**Before this can take real money, on the VPS:**

1. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env.local`
2. The Stripe dashboard webhook endpoint pointing at
   `https://bsymbolic.com/api/stripe/webhook`
3. A rebuild and `pm2 restart symbolic --update-env`
4. An end-to-end test in Stripe **test mode** before switching to live keys
