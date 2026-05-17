# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin panel for the Symbolic ad platform with a moderation queue, platform stats, ad management, and advertiser visibility, gated by an email allowlist.

**Architecture:** A new `(admin)` route group at `src/app/[locale]/(admin)/admin/...`. Admins are identified by the `ADMIN_EMAILS` env var. Ads gain a `status` column (`pending` | `approved` | `rejected`); only `approved` + `active` ads serve in search. Server actions in `src/libs/adminActions.ts` handle approve/reject/suspend. Auth helpers live in `src/libs/admin.ts`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind v4, Drizzle ORM (PostgreSQL/PGLite), `@clerk/nextjs` v7 (`currentUser()`), Zod v4, next-intl, Vitest (unit tests with real PGLite DB + mocked Clerk).

---

## Important: existing patterns to follow

- **Server actions:** start with `'use server'`, call `currentUser()` for auth, return `{ error: string }` / `{ success: true }` / `undefined`. Wrap `revalidatePath` in `try/catch` (it throws outside the Next.js runtime). See `src/libs/adActions.ts`.
- **Drizzle `ads` field names:** `title`, `url`, `displayUrl`, `description`, `ctaText`, `keywords` (text[]), `bidAmount` (integer pence), `active` (boolean), `advertiserId`, `advertiserName`, `createdAt`.
- **Tests:** `*.test.ts` co-located. Mock Clerk with `vi.mock('@clerk/nextjs/server', () => ({ currentUser: vi.fn() }))` then `const { currentUser } = await import('@clerk/nextjs/server')`. Use a real PGLite DB. Generate unique Clerk ids with `crypto.randomUUID()`. Clean up rows in `afterEach`.
- **i18n:** no hard-coded user-visible strings. Server components use `getTranslations('NamespacePage')`. Keys go in `src/locales/en.json` and `src/locales/fr.json`. Page namespaces end with `Page`.
- **Pages:** default export name ends with `Page`; `await props.params` then `setRequestLocale(locale)`.
- **React:** single `props` param, access as `props.foo` (no destructuring of `props`); no `useMemo`/`useCallback`; `React.ReactNode`.
- **Commands:** `bun run check:types`, `bun run lint`, `bun run test`. Database: `npm run db:generate` (drizzle-kit generate), `npm run db:migrate`. The dev server auto-migrates on start.

---

## File map

| File | Action | Purpose |
|---|---|---|
| `src/models/Schema.ts` | Modify | Add `status`, `rejectionReason`, `reviewedAt`, `reviewedBy` to `ads` |
| `migrations/0003_*.sql` | Create (generated) | Migration adding columns + backfilling `status='approved'` |
| `src/libs/Env.ts` | Modify | Add `ADMIN_EMAILS` |
| `.env` | Modify | Add `ADMIN_EMAILS` dev/test default |
| `src/libs/admin.ts` | Create | Admin auth helpers |
| `src/libs/admin.test.ts` | Create | Tests for `isAdminEmail` |
| `src/libs/ads.ts` | Modify | `selectAds` filters on `status='approved'` |
| `src/libs/ads.test.ts` | Create | Tests for `selectAds` status filtering |
| `src/libs/adminActions.ts` | Create | `approveAd`, `rejectAd`, `suspendAd`, `unsuspendAd` |
| `src/libs/adminActions.test.ts` | Create | Tests for the 4 admin actions |
| `src/libs/adminStats.ts` | Create | Dashboard stat queries |
| `src/middleware.ts` | Modify | Protect `/admin` routes |
| `src/app/[locale]/(admin)/admin/layout.tsx` | Create | Admin nav + `requireAdmin()` gate |
| `src/app/[locale]/(admin)/admin/dashboard/page.tsx` | Create | Stats dashboard |
| `src/app/[locale]/(admin)/admin/queue/page.tsx` | Create | Pending review queue |
| `src/app/[locale]/(admin)/admin/queue/QueueRowActions.tsx` | Create | Client approve/reject buttons |
| `src/app/[locale]/(admin)/admin/ads/page.tsx` | Create | All ads with status filter |
| `src/app/[locale]/(admin)/admin/ads/AdminAdActions.tsx` | Create | Client suspend/unsuspend button |
| `src/app/[locale]/(admin)/admin/advertisers/page.tsx` | Create | Advertiser list |
| `src/app/[locale]/(admin)/admin/advertisers/[id]/page.tsx` | Create | Advertiser detail |
| `src/app/[locale]/(portal)/advertise/ads/page.tsx` | Modify | Four status badges |
| `src/locales/en.json` / `fr.json` | Modify | Admin i18n keys |

---

## Task 1: Schema columns and migration

**Files:**
- Modify: `src/models/Schema.ts:41-54`
- Create: `migrations/0003_*.sql` (generated)

- [ ] **Step 1: Add the four columns to the `ads` table**

In `src/models/Schema.ts`, replace the `ads` table definition (currently lines 41-54) with:

```ts
export const ads = pgTable('ads', {
  id: serial('id').primaryKey(),
  advertiserId: integer('advertiser_id').references(() => advertisers.id),
  advertiserName: text('advertiser_name').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  displayUrl: text('display_url').notNull(),
  description: text('description').notNull(),
  ctaText: text('cta_text').notNull(),
  keywords: text('keywords').array().notNull(),
  bidAmount: integer('bid_amount').notNull(),
  active: boolean('active').notNull().default(true),
  status: text('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: text('reviewed_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: a new file `migrations/0003_<random-name>.sql` is created containing four `ALTER TABLE "ads" ADD COLUMN ...` statements.

- [ ] **Step 3: Append the backfill statement to the generated migration**

Open the new `migrations/0003_*.sql` file. After the last `ALTER TABLE` statement, add a statement-breakpoint and the backfill UPDATE so all pre-existing ads remain live:

```sql
--> statement-breakpoint
UPDATE "ads" SET "status" = 'approved';
```

The file should end with that UPDATE. (Newly created ads still default to `'pending'` via the column default; the UPDATE only affects rows that existed at migration time.)

- [ ] **Step 4: Apply the migration**

Run: `npm run db:migrate`
Expected: migration `0003` applies with no errors.

- [ ] **Step 5: Type-check**

Run: `bun run check:types`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/models/Schema.ts migrations/
git commit -m "feat: add status and review columns to ads table"
```

---

## Task 2: ADMIN_EMAILS environment variable

**Files:**
- Modify: `src/libs/Env.ts`
- Modify: `.env`

- [ ] **Step 1: Add `ADMIN_EMAILS` to the Env schema**

In `src/libs/Env.ts`, add `ADMIN_EMAILS` to the `server` block and to `runtimeEnv`. The full file becomes:

```ts
import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

export const Env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    BRAVE_SEARCH_API_KEY: z.string().min(1),
    BRAVE_API_BASE_URL: z.url().optional(),
    CLERK_SECRET_KEY: z.string().min(1),
    ADMIN_EMAILS: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  },
  shared: {
    NODE_ENV: z.enum(['test', 'development', 'production']).optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
    BRAVE_API_BASE_URL: process.env.BRAVE_API_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  },
  skipValidation: process.env.NODE_ENV === 'test',
});
```

- [ ] **Step 2: Add the dev/test default to `.env`**

Append to `.env`:

```
# Comma-separated list of admin email addresses. Override in .env.local for production.
ADMIN_EMAILS=admin@symbolic.test
```

This value is the dev default and is what the test suite relies on. Real admins are set by overriding `ADMIN_EMAILS` in `.env.local` or the hosting environment.

- [ ] **Step 3: Type-check**

Run: `bun run check:types`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/libs/Env.ts .env
git commit -m "feat: add ADMIN_EMAILS env var for admin allowlist"
```

---

## Task 3: Admin auth helpers

**Files:**
- Create: `src/libs/admin.ts`
- Create: `src/libs/admin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/libs/admin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isAdminEmail } from './admin';

// The test suite runs with ADMIN_EMAILS=admin@symbolic.test (from .env).

describe('admin', () => {
  describe('isAdminEmail', () => {
    it('returns true for an allowlisted email', () => {
      expect(isAdminEmail('admin@symbolic.test')).toBe(true);
    });

    it('matches case-insensitively', () => {
      expect(isAdminEmail('ADMIN@Symbolic.Test')).toBe(true);
    });

    it('returns false for a non-listed email', () => {
      expect(isAdminEmail('nobody@example.com')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(isAdminEmail('')).toBe(false);
    });

    it('returns false for null or undefined', () => {
      expect(isAdminEmail(null)).toBe(false);
      expect(isAdminEmail(undefined)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/libs/admin.test.ts`
Expected: FAIL — `isAdminEmail` is not defined / module not found.

- [ ] **Step 3: Write the implementation**

Create `src/libs/admin.ts`:

```ts
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Env } from './Env';

/**
 * Returns the configured admin emails as a lowercased, trimmed list.
 */
function adminList(): string[] {
  return (Env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Checks whether an email address is in the admin allowlist.
 * @param email - The email address to check.
 * @returns True when the email is an allowlisted admin.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return adminList().includes(email.toLowerCase());
}

/**
 * Returns the current Clerk user when they are an admin, otherwise null.
 * @returns The admin Clerk user, or null.
 */
export async function getAdminUser() {
  const user = await currentUser();
  if (!user) {
    return null;
  }
  return isAdminEmail(user.primaryEmailAddress?.emailAddress) ? user : null;
}

/**
 * Returns the current admin Clerk user, or redirects to sign-in when the
 * caller is not an admin.
 * @param locale - Current locale used to build the sign-in redirect path.
 * @returns The admin Clerk user.
 */
export async function requireAdmin(locale: string) {
  const user = await getAdminUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }
  return user;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/libs/admin.test.ts`
Expected: PASS — all 5 tests.

- [ ] **Step 5: Type-check and lint**

Run: `bun run check:types && bun run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/libs/admin.ts src/libs/admin.test.ts
git commit -m "feat: add admin auth helpers backed by ADMIN_EMAILS"
```

---

## Task 4: Restrict ad serving to approved ads

**Files:**
- Modify: `src/libs/ads.ts:38-52`
- Create: `src/libs/ads.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/libs/ads.test.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ads, advertisers } from '@/models/Schema';
import { db } from './DB';
import { selectAds } from './ads';

describe('selectAds', () => {
  let advertiserId: number;
  const insertedAdIds: number[] = [];

  beforeEach(async () => {
    const [adv] = await db
      .insert(advertisers)
      .values({
        clerkUserId: `test_${crypto.randomUUID()}`,
        email: 'ads-test@example.com',
        name: 'Ads Test',
      })
      .returning();
    advertiserId = adv!.id;
  });

  afterEach(async () => {
    if (insertedAdIds.length > 0) {
      await db.delete(ads).where(inArray(ads.id, insertedAdIds));
      insertedAdIds.length = 0;
    }
    await db.delete(advertisers).where(eq(advertisers.id, advertiserId));
  });

  async function insertAd(status: string, active: boolean) {
    const [ad] = await db
      .insert(ads)
      .values({
        advertiserId,
        advertiserName: 'Ads Test',
        title: 'Running shoes',
        url: 'https://example.com',
        displayUrl: 'example.com',
        description: '',
        ctaText: 'Shop',
        keywords: ['running'],
        bidAmount: 100,
        active,
        status,
      })
      .returning();
    insertedAdIds.push(ad!.id);
    return ad!.id;
  }

  it('includes an approved active ad', async () => {
    const id = await insertAd('approved', true);
    const result = await selectAds('running');
    expect(result.map((ad) => ad.id)).toContain(id);
  });

  it('excludes a pending ad', async () => {
    const id = await insertAd('pending', true);
    const result = await selectAds('running');
    expect(result.map((ad) => ad.id)).not.toContain(id);
  });

  it('excludes a rejected ad', async () => {
    const id = await insertAd('rejected', true);
    const result = await selectAds('running');
    expect(result.map((ad) => ad.id)).not.toContain(id);
  });

  it('excludes an approved but inactive ad', async () => {
    const id = await insertAd('approved', false);
    const result = await selectAds('running');
    expect(result.map((ad) => ad.id)).not.toContain(id);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/libs/ads.test.ts`
Expected: FAIL — the pending and rejected ads are included because `selectAds` does not yet filter on `status`.

- [ ] **Step 3: Add the status filter to `selectAds`**

In `src/libs/ads.ts`, the `selectAds` `.where(...)` currently contains `and(eq(ads.active, true), sql\`...\`)`. Add `eq(ads.status, 'approved')` as the first argument to `and(...)`. The function becomes:

```ts
export const selectAds = async (query: string): Promise<Ad[]> => {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return [];
  }

  // The && operator checks array overlap. Drizzle's query builder does not
  // support &&, so we use a raw SQL fragment. The ::text[] cast is required
  // for PGlite to resolve the operator overload correctly.
  const result = await db
    .select()
    .from(ads)
    .where(
      and(
        eq(ads.status, 'approved'),
        eq(ads.active, true),
        sql`${ads.keywords} && ARRAY[${sql.join(
          tokens.map((t) => sql`${t}`),
          sql`, `
        )}]::text[]`
      )
    )
    .orderBy(desc(ads.bidAmount))
    .limit(2);
  return result;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/libs/ads.test.ts`
Expected: PASS — all 4 tests.

- [ ] **Step 5: Type-check and lint**

Run: `bun run check:types && bun run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/libs/ads.ts src/libs/ads.test.ts
git commit -m "feat: serve only approved ads in search results"
```

---

## Task 5: Admin server actions

**Files:**
- Create: `src/libs/adminActions.ts`
- Create: `src/libs/adminActions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/libs/adminActions.test.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ads, advertisers } from '@/models/Schema';
import { approveAd, rejectAd, suspendAd, unsuspendAd } from './adminActions';
import { db } from './DB';

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
}));

const { currentUser } = await import('@clerk/nextjs/server');
const mockCurrentUser = vi.mocked(currentUser);

function asAdmin() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  mockCurrentUser.mockResolvedValue({
    id: 'admin_clerk_id',
    primaryEmailAddress: { emailAddress: 'admin@symbolic.test' },
  } as never);
}

function asNonAdmin() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  mockCurrentUser.mockResolvedValue({
    id: 'user_clerk_id',
    primaryEmailAddress: { emailAddress: 'nobody@example.com' },
  } as never);
}

describe('adminActions', () => {
  let advertiserId: number;
  const insertedAdIds: number[] = [];

  beforeEach(async () => {
    const [adv] = await db
      .insert(advertisers)
      .values({
        clerkUserId: `test_${crypto.randomUUID()}`,
        email: 'admin-actions@example.com',
        name: 'Admin Actions Test',
      })
      .returning();
    advertiserId = adv!.id;
  });

  afterEach(async () => {
    if (insertedAdIds.length > 0) {
      await db.delete(ads).where(inArray(ads.id, insertedAdIds));
      insertedAdIds.length = 0;
    }
    await db.delete(advertisers).where(eq(advertisers.id, advertiserId));
    vi.clearAllMocks();
  });

  async function insertAd(status: string, active = true) {
    const [ad] = await db
      .insert(ads)
      .values({
        advertiserId,
        advertiserName: 'Admin Actions Test',
        title: 'Test ad',
        url: 'https://example.com',
        displayUrl: 'example.com',
        description: '',
        ctaText: 'Shop',
        keywords: ['test'],
        bidAmount: 100,
        active,
        status,
      })
      .returning();
    insertedAdIds.push(ad!.id);
    return ad!.id;
  }

  describe('approveAd', () => {
    it('sets status to approved with audit fields', async () => {
      asAdmin();
      const id = await insertAd('pending');

      await approveAd(id);

      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.status).toBe('approved');
      expect(row?.reviewedBy).toBe('admin_clerk_id');
      expect(row?.reviewedAt).toBeInstanceOf(Date);
    });

    it('refuses a non-admin caller', async () => {
      asNonAdmin();
      const id = await insertAd('pending');

      const result = await approveAd(id);

      expect(result).toHaveProperty('error');
      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.status).toBe('pending');
    });
  });

  describe('rejectAd', () => {
    it('sets status to rejected with reason and audit fields', async () => {
      asAdmin();
      const id = await insertAd('pending');

      await rejectAd(id, 'Misleading headline');

      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.status).toBe('rejected');
      expect(row?.rejectionReason).toBe('Misleading headline');
      expect(row?.reviewedBy).toBe('admin_clerk_id');
      expect(row?.reviewedAt).toBeInstanceOf(Date);
    });

    it('refuses an empty reason', async () => {
      asAdmin();
      const id = await insertAd('pending');

      const result = await rejectAd(id, '');

      expect(result).toHaveProperty('error');
      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.status).toBe('pending');
    });

    it('refuses a reason longer than 300 characters', async () => {
      asAdmin();
      const id = await insertAd('pending');

      const result = await rejectAd(id, 'x'.repeat(301));

      expect(result).toHaveProperty('error');
      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.status).toBe('pending');
    });
  });

  describe('suspendAd', () => {
    it('sets active to false', async () => {
      asAdmin();
      const id = await insertAd('approved', true);

      await suspendAd(id);

      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.active).toBe(false);
    });
  });

  describe('unsuspendAd', () => {
    it('sets active to true', async () => {
      asAdmin();
      const id = await insertAd('approved', false);

      await unsuspendAd(id);

      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.active).toBe(true);
    });
  });

  it('treats an action on a missing ad id as a no-op', async () => {
    asAdmin();
    const result = await approveAd(999999);
    expect(result).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/libs/adminActions.test.ts`
Expected: FAIL — module `./adminActions` not found.

- [ ] **Step 3: Write the implementation**

Create `src/libs/adminActions.ts`:

```ts
'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { ads } from '@/models/Schema';
import { getAdminUser } from './admin';
import { db } from './DB';

const rejectReasonSchema = z.string().min(1).max(300);

/**
 * Revalidates the admin queue and ads list pages, ignoring errors thrown
 * outside the Next.js runtime (e.g. during tests).
 */
function revalidateAdminPaths() {
  try {
    revalidatePath('/admin/queue');
    revalidatePath('/admin/ads');
  } catch {
    // no-op outside Next.js runtime
  }
}

/**
 * Approves a pending ad. Admin only.
 * @param id - The ad's database ID.
 * @returns An error object when refused, otherwise undefined.
 */
export async function approveAd(
  id: number
): Promise<{ error: string } | undefined> {
  const admin = await getAdminUser();
  if (!admin) {
    return { error: 'Not authorized' };
  }

  await db
    .update(ads)
    .set({ status: 'approved', reviewedAt: new Date(), reviewedBy: admin.id })
    .where(eq(ads.id, id));

  revalidateAdminPaths();
  return undefined;
}

/**
 * Rejects an ad with a reason. Admin only.
 * @param id - The ad's database ID.
 * @param reason - The rejection reason shown to the advertiser.
 * @returns An error object when refused, otherwise undefined.
 */
export async function rejectAd(
  id: number,
  reason: string
): Promise<{ error: string } | undefined> {
  const admin = await getAdminUser();
  if (!admin) {
    return { error: 'Not authorized' };
  }

  const parsed = rejectReasonSchema.safeParse(reason);
  if (!parsed.success) {
    return { error: 'A rejection reason of 1-300 characters is required' };
  }

  await db
    .update(ads)
    .set({
      status: 'rejected',
      rejectionReason: parsed.data,
      reviewedAt: new Date(),
      reviewedBy: admin.id,
    })
    .where(eq(ads.id, id));

  revalidateAdminPaths();
  return undefined;
}

/**
 * Suspends an ad by clearing its active flag. Admin only.
 * @param id - The ad's database ID.
 * @returns An error object when refused, otherwise undefined.
 */
export async function suspendAd(
  id: number
): Promise<{ error: string } | undefined> {
  const admin = await getAdminUser();
  if (!admin) {
    return { error: 'Not authorized' };
  }

  await db.update(ads).set({ active: false }).where(eq(ads.id, id));

  revalidateAdminPaths();
  return undefined;
}

/**
 * Unsuspends an ad by setting its active flag. Admin only.
 * @param id - The ad's database ID.
 * @returns An error object when refused, otherwise undefined.
 */
export async function unsuspendAd(
  id: number
): Promise<{ error: string } | undefined> {
  const admin = await getAdminUser();
  if (!admin) {
    return { error: 'Not authorized' };
  }

  await db.update(ads).set({ active: true }).where(eq(ads.id, id));

  revalidateAdminPaths();
  return undefined;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/libs/adminActions.test.ts`
Expected: PASS — all tests. (An update on a missing id affects 0 rows and returns `undefined`.)

- [ ] **Step 5: Type-check and lint**

Run: `bun run check:types && bun run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/libs/adminActions.ts src/libs/adminActions.test.ts
git commit -m "feat: add admin server actions for ad moderation"
```

---

## Task 6: Dashboard stat queries

**Files:**
- Create: `src/libs/adminStats.ts`

- [ ] **Step 1: Write the implementation**

Create `src/libs/adminStats.ts`:

```ts
import { count, eq, gte, sql } from 'drizzle-orm';
import { adClicks, ads, advertisers } from '@/models/Schema';
import { db } from './DB';

export type AdminStats = {
  advertiserCount: number;
  totalAds: number;
  pendingAds: number;
  approvedAds: number;
  rejectedAds: number;
  clicksLast30Days: number;
  revenuePenceLast30Days: number;
};

/**
 * Returns the timestamp 30 days before now.
 */
function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

/**
 * Collects platform-wide stats for the admin dashboard.
 * @returns The aggregated admin stats.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const since = thirtyDaysAgo();

  const [advertiserRow] = await db
    .select({ value: count() })
    .from(advertisers);

  const statusRows = await db
    .select({ status: ads.status, value: count() })
    .from(ads)
    .groupBy(ads.status);

  const [clicksRow] = await db
    .select({ value: count() })
    .from(adClicks)
    .where(gte(adClicks.clickedAt, since));

  const [revenueRow] = await db
    .select({
      value: sql<number>`coalesce(sum(${ads.bidAmount}), 0)`.mapWith(Number),
    })
    .from(adClicks)
    .innerJoin(ads, eq(adClicks.adId, ads.id))
    .where(gte(adClicks.clickedAt, since));

  const byStatus = (target: string) =>
    statusRows.find((row) => row.status === target)?.value ?? 0;

  const pendingAds = byStatus('pending');
  const approvedAds = byStatus('approved');
  const rejectedAds = byStatus('rejected');

  return {
    advertiserCount: advertiserRow?.value ?? 0,
    totalAds: pendingAds + approvedAds + rejectedAds,
    pendingAds,
    approvedAds,
    rejectedAds,
    clicksLast30Days: clicksRow?.value ?? 0,
    revenuePenceLast30Days: revenueRow?.value ?? 0,
  };
}
```

- [ ] **Step 2: Type-check and lint**

Run: `bun run check:types && bun run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/libs/adminStats.ts
git commit -m "feat: add admin dashboard stat queries"
```

---

## Task 7: Middleware and admin layout

**Files:**
- Modify: `src/middleware.ts:7-11`
- Create: `src/app/[locale]/(admin)/admin/layout.tsx`
- Modify: `src/locales/en.json`, `src/locales/fr.json`

- [ ] **Step 1: Add the admin route to the protected matcher**

In `src/middleware.ts`, add `/:locale/admin(.*)` to the `createRouteMatcher` array:

```ts
const isProtectedRoute = createRouteMatcher([
  '/:locale/advertise/dashboard(.*)',
  '/:locale/advertise/ads(.*)',
  '/:locale/advertise/create(.*)',
  '/:locale/admin(.*)',
]);
```

- [ ] **Step 2: Add admin i18n keys**

In `src/locales/en.json`, add this entry after the `"AdsPage"` block (keep JSON valid — add a comma where needed):

```json
  "AdminLayout": {
    "nav_dashboard": "Dashboard",
    "nav_queue": "Queue",
    "nav_ads": "Ads",
    "nav_advertisers": "Advertisers"
  },
  "AdminDashboardPage": {
    "title": "Admin dashboard",
    "stat_advertisers": "Advertisers",
    "stat_total_ads": "Total ads",
    "stat_breakdown": "{pending} pending · {approved} approved · {rejected} rejected",
    "stat_clicks": "Clicks (30 days)",
    "stat_revenue": "Bid revenue (30 days)",
    "queue_banner": "{count} ads awaiting review →"
  },
  "AdminQueuePage": {
    "title": "Review queue",
    "empty": "No ads awaiting review",
    "advertiser_label": "Advertiser",
    "keywords_label": "Keywords",
    "bid_label": "Bid",
    "approve": "Approve",
    "reject": "Reject",
    "reject_reason_placeholder": "Reason for rejection",
    "reject_confirm": "Confirm rejection",
    "reject_cancel": "Cancel"
  },
  "AdminAdsPage": {
    "title": "All ads",
    "filter_all": "All",
    "filter_pending": "Pending",
    "filter_approved": "Approved",
    "filter_rejected": "Rejected",
    "filter_paused": "Paused",
    "col_title": "Title",
    "col_advertiser": "Advertiser",
    "col_status": "Status",
    "col_bid": "Bid",
    "col_clicks": "Clicks",
    "col_created": "Created",
    "col_actions": "Actions",
    "status_pending": "Pending",
    "status_approved": "Approved",
    "status_rejected": "Rejected",
    "status_paused": "Paused",
    "suspend": "Suspend",
    "unsuspend": "Unsuspend",
    "empty": "No ads match this filter"
  },
  "AdminAdvertisersPage": {
    "title": "Advertisers",
    "col_name": "Name",
    "col_email": "Email",
    "col_ads": "Ads",
    "col_clicks": "Clicks",
    "col_joined": "Joined",
    "view": "View",
    "empty": "No advertisers yet"
  },
  "AdminAdvertiserDetailPage": {
    "email_label": "Email",
    "joined_label": "Joined",
    "ads_title": "Ads",
    "no_ads": "This advertiser has no ads",
    "status_pending": "Pending review",
    "status_approved_active": "Approved & active",
    "status_approved_paused": "Approved & paused",
    "status_rejected": "Rejected"
  },
```

In `src/locales/fr.json`, add the same keys with the same English values (translating is out of scope; keeping the keys present keeps `check:i18n` happy). Use identical structure and values.

- [ ] **Step 3: Create the admin layout**

Create `src/app/[locale]/(admin)/admin/layout.tsx`:

```tsx
import { UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { requireAdmin } from '@/libs/admin';

export const metadata: Metadata = {
  title: 'Admin — Symbolic',
};

export default async function AdminLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations('AdminLayout');

  return (
    <div className="min-h-screen bg-[#0d0d14] text-white">
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-8">
          <Link
            href={`/${locale}/admin/dashboard`}
            className="text-sm font-semibold tracking-wide text-white/80"
          >
            Symbolic Admin
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href={`/${locale}/admin/dashboard`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_dashboard')}
            </Link>
            <Link
              href={`/${locale}/admin/queue`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_queue')}
            </Link>
            <Link
              href={`/${locale}/admin/ads`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_ads')}
            </Link>
            <Link
              href={`/${locale}/admin/advertisers`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_advertisers')}
            </Link>
          </div>
        </div>
        <UserButton />
      </nav>
      <main>{props.children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Type-check, lint, and check i18n**

Run: `bun run check:types && bun run lint && bun run check:i18n`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts "src/app/\[locale\]/\(admin\)" src/locales/en.json src/locales/fr.json
git commit -m "feat: add admin route protection, layout, and i18n keys"
```

---

## Task 8: Admin dashboard page

**Files:**
- Create: `src/app/[locale]/(admin)/admin/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page**

Create `src/app/[locale]/(admin)/admin/dashboard/page.tsx`:

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { getAdminStats } from '@/libs/adminStats';

export default async function AdminDashboardPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('AdminDashboardPage');

  const stats = await getAdminStats();
  const revenuePounds = (stats.revenuePenceLast30Days / 100).toFixed(2);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>

      {stats.pendingAds > 0 && (
        <Link
          href={`/${locale}/admin/queue`}
          className="mb-8 block rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm font-semibold text-yellow-300 hover:bg-yellow-500/20"
        >
          {t('queue_banner', { count: stats.pendingAds })}
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
          <div className="text-xs tracking-wide text-white/40 uppercase">
            {t('stat_advertisers')}
          </div>
          <div className="mt-1 text-3xl font-bold">{stats.advertiserCount}</div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
          <div className="text-xs tracking-wide text-white/40 uppercase">
            {t('stat_total_ads')}
          </div>
          <div className="mt-1 text-3xl font-bold">{stats.totalAds}</div>
          <div className="mt-1 text-xs text-white/50">
            {t('stat_breakdown', {
              pending: stats.pendingAds,
              approved: stats.approvedAds,
              rejected: stats.rejectedAds,
            })}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
          <div className="text-xs tracking-wide text-white/40 uppercase">
            {t('stat_clicks')}
          </div>
          <div className="mt-1 text-3xl font-bold">
            {stats.clicksLast30Days}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
          <div className="text-xs tracking-wide text-white/40 uppercase">
            {t('stat_revenue')}
          </div>
          <div className="mt-1 text-3xl font-bold">£{revenuePounds}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `bun run check:types && bun run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/\[locale\]/\(admin\)/admin/dashboard/page.tsx"
git commit -m "feat: add admin dashboard page with platform stats"
```

---

## Task 9: Review queue page

**Files:**
- Create: `src/app/[locale]/(admin)/admin/queue/QueueRowActions.tsx`
- Create: `src/app/[locale]/(admin)/admin/queue/page.tsx`

- [ ] **Step 1: Create the client action component**

Create `src/app/[locale]/(admin)/admin/queue/QueueRowActions.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { approveAd, rejectAd } from '@/libs/adminActions';

export function QueueRowActions(props: {
  adId: number;
  labels: {
    approve: string;
    reject: string;
    reasonPlaceholder: string;
    confirm: string;
    cancel: string;
  };
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleApprove() {
    setBusy(true);
    await approveAd(props.adId);
    router.refresh();
  }

  async function handleReject() {
    setBusy(true);
    const result = await rejectAd(props.adId, reason);
    if (result && 'error' in result) {
      setBusy(false);
      return;
    }
    router.refresh();
  }

  if (rejecting) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={props.labels.reasonPlaceholder}
          className="rounded border border-white/15 bg-white/5 px-2 py-1 text-sm"
          rows={2}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleReject}
            className="rounded bg-red-600 px-3 py-1 text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
          >
            {props.labels.confirm}
          </button>
          <button
            type="button"
            onClick={() => setRejecting(false)}
            className="rounded border border-white/15 px-3 py-1 text-xs hover:bg-white/5"
          >
            {props.labels.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={handleApprove}
        className="rounded bg-green-600 px-3 py-1 text-xs font-semibold hover:bg-green-500 disabled:opacity-50"
      >
        {props.labels.approve}
      </button>
      <button
        type="button"
        onClick={() => setRejecting(true)}
        className="rounded border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10"
      >
        {props.labels.reject}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create the queue page**

Create `src/app/[locale]/(admin)/admin/queue/page.tsx`:

```tsx
import { asc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/libs/DB';
import { ads } from '@/models/Schema';
import { QueueRowActions } from './QueueRowActions';

export default async function AdminQueuePage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('AdminQueuePage');

  const pendingAds = await db
    .select()
    .from(ads)
    .where(eq(ads.status, 'pending'))
    .orderBy(asc(ads.createdAt));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>

      {pendingAds.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 px-6 py-16 text-center text-white/50">
          {t('empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {pendingAds.map((ad) => (
            <div
              key={ad.id}
              className="rounded-lg border border-white/10 bg-white/5 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold">{ad.title}</div>
                  <div className="text-xs text-green-400">{ad.displayUrl}</div>
                  <p className="mt-1 text-sm text-white/60">{ad.description}</p>
                  <div className="mt-2 text-xs text-white/40">
                    {ad.ctaText}
                  </div>
                  <div className="mt-2 text-xs text-white/50">
                    {t('advertiser_label')}: {ad.advertiserName}
                  </div>
                  <div className="text-xs text-white/50">
                    {t('keywords_label')}: {ad.keywords.join(', ')}
                  </div>
                  <div className="text-xs text-white/50">
                    {t('bid_label')}: £{(ad.bidAmount / 100).toFixed(2)}
                  </div>
                </div>
                <QueueRowActions
                  adId={ad.id}
                  labels={{
                    approve: t('approve'),
                    reject: t('reject'),
                    reasonPlaceholder: t('reject_reason_placeholder'),
                    confirm: t('reject_confirm'),
                    cancel: t('reject_cancel'),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `bun run check:types && bun run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/\[locale\]/\(admin\)/admin/queue"
git commit -m "feat: add admin review queue page with approve and reject"
```

---

## Task 10: All-ads page with status filter

**Files:**
- Create: `src/app/[locale]/(admin)/admin/ads/AdminAdActions.tsx`
- Create: `src/app/[locale]/(admin)/admin/ads/page.tsx`

- [ ] **Step 1: Create the client suspend/unsuspend component**

Create `src/app/[locale]/(admin)/admin/ads/AdminAdActions.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { suspendAd, unsuspendAd } from '@/libs/adminActions';

export function AdminAdActions(props: {
  adId: number;
  isActive: boolean;
  labels: { suspend: string; unsuspend: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    if (props.isActive) {
      await suspendAd(props.adId);
    } else {
      await unsuspendAd(props.adId);
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleClick}
      className="rounded border border-white/15 px-3 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
    >
      {props.isActive ? props.labels.suspend : props.labels.unsuspend}
    </button>
  );
}
```

- [ ] **Step 2: Create the all-ads page**

Create `src/app/[locale]/(admin)/admin/ads/page.tsx`. The status filter is read from the `status` search param; `paused` means `status='approved'` and `active=false`.

```tsx
import { count, desc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { db } from '@/libs/DB';
import { adClicks, ads } from '@/models/Schema';
import { AdminAdActions } from './AdminAdActions';

const FILTERS = ['all', 'pending', 'approved', 'rejected', 'paused'] as const;

type AdsFilter = (typeof FILTERS)[number];

function parseFilter(raw: string | undefined): AdsFilter {
  return FILTERS.includes(raw as AdsFilter) ? (raw as AdsFilter) : 'all';
}

export default async function AdminAdsPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const { status } = await props.searchParams;
  const filter = parseFilter(status);
  const t = await getTranslations('AdminAdsPage');

  const allAds = await db.select().from(ads).orderBy(desc(ads.createdAt));

  const clickRows = await db
    .select({ adId: adClicks.adId, value: count() })
    .from(adClicks)
    .groupBy(adClicks.adId);
  const clicksByAd = new Map(clickRows.map((row) => [row.adId, row.value]));

  const filteredAds = allAds.filter((ad) => {
    if (filter === 'all') {
      return true;
    }
    if (filter === 'paused') {
      return ad.status === 'approved' && !ad.active;
    }
    return ad.status === filter;
  });

  function statusLabel(ad: (typeof allAds)[number]): string {
    if (ad.status === 'approved' && !ad.active) {
      return t('status_paused');
    }
    if (ad.status === 'pending') {
      return t('status_pending');
    }
    if (ad.status === 'rejected') {
      return t('status_rejected');
    }
    return t('status_approved');
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-6 flex gap-2">
        {FILTERS.map((value) => (
          <Link
            key={value}
            href={`/${locale}/admin/ads?status=${value}`}
            className={`rounded px-3 py-1 text-xs font-semibold ${
              filter === value
                ? 'bg-indigo-600 text-white'
                : 'border border-white/15 text-white/60 hover:bg-white/5'
            }`}
          >
            {t(`filter_${value}`)}
          </Link>
        ))}
      </div>

      {filteredAds.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 px-6 py-16 text-center text-white/50">
          {t('empty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="grid grid-cols-[2fr_1fr_90px_70px_60px_110px_100px] gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold tracking-wide text-white/40 uppercase">
            <span>{t('col_title')}</span>
            <span>{t('col_advertiser')}</span>
            <span>{t('col_status')}</span>
            <span>{t('col_bid')}</span>
            <span>{t('col_clicks')}</span>
            <span>{t('col_created')}</span>
            <span>{t('col_actions')}</span>
          </div>
          {filteredAds.map((ad) => (
            <div
              key={ad.id}
              className="grid grid-cols-[2fr_1fr_90px_70px_60px_110px_100px] items-center gap-4 border-b border-white/5 px-4 py-3 text-sm last:border-0"
            >
              <span className="truncate">{ad.title}</span>
              <span className="truncate text-white/50">
                {ad.advertiserName}
              </span>
              <span className="text-xs text-white/70">{statusLabel(ad)}</span>
              <span>£{(ad.bidAmount / 100).toFixed(2)}</span>
              <span>{clicksByAd.get(ad.id) ?? 0}</span>
              <span className="text-xs text-white/50">
                {ad.createdAt.toISOString().slice(0, 10)}
              </span>
              <span>
                {ad.status === 'approved' ? (
                  <AdminAdActions
                    adId={ad.id}
                    isActive={ad.active}
                    labels={{
                      suspend: t('suspend'),
                      unsuspend: t('unsuspend'),
                    }}
                  />
                ) : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `bun run check:types && bun run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/\[locale\]/\(admin\)/admin/ads"
git commit -m "feat: add admin all-ads page with status filter and suspend"
```

---

## Task 11: Advertiser list and detail pages

**Files:**
- Create: `src/app/[locale]/(admin)/admin/advertisers/page.tsx`
- Create: `src/app/[locale]/(admin)/admin/advertisers/[id]/page.tsx`

- [ ] **Step 1: Create the advertiser list page**

Create `src/app/[locale]/(admin)/admin/advertisers/page.tsx`:

```tsx
import { count, desc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { db } from '@/libs/DB';
import { adClicks, ads, advertisers } from '@/models/Schema';

export default async function AdminAdvertisersPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('AdminAdvertisersPage');

  const allAdvertisers = await db
    .select()
    .from(advertisers)
    .orderBy(desc(advertisers.createdAt));

  const adCountRows = await db
    .select({ advertiserId: ads.advertiserId, value: count() })
    .from(ads)
    .groupBy(ads.advertiserId);
  const adsByAdvertiser = new Map(
    adCountRows.map((row) => [row.advertiserId, row.value])
  );

  const clickCountRows = await db
    .select({ advertiserId: ads.advertiserId, value: count() })
    .from(adClicks)
    .innerJoin(ads, eq(adClicks.adId, ads.id))
    .groupBy(ads.advertiserId);
  const clicksByAdvertiser = new Map(
    clickCountRows.map((row) => [row.advertiserId, row.value])
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      {allAdvertisers.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 px-6 py-16 text-center text-white/50">
          {t('empty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="grid grid-cols-[1.5fr_2fr_60px_70px_110px_80px] gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold tracking-wide text-white/40 uppercase">
            <span>{t('col_name')}</span>
            <span>{t('col_email')}</span>
            <span>{t('col_ads')}</span>
            <span>{t('col_clicks')}</span>
            <span>{t('col_joined')}</span>
            <span />
          </div>
          {allAdvertisers.map((advertiser) => (
            <div
              key={advertiser.id}
              className="grid grid-cols-[1.5fr_2fr_60px_70px_110px_80px] items-center gap-4 border-b border-white/5 px-4 py-3 text-sm last:border-0"
            >
              <span className="truncate">{advertiser.name}</span>
              <span className="truncate text-white/50">
                {advertiser.email}
              </span>
              <span>{adsByAdvertiser.get(advertiser.id) ?? 0}</span>
              <span>{clicksByAdvertiser.get(advertiser.id) ?? 0}</span>
              <span className="text-xs text-white/50">
                {advertiser.createdAt.toISOString().slice(0, 10)}
              </span>
              <Link
                href={`/${locale}/admin/advertisers/${advertiser.id}`}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
              >
                {t('view')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the advertiser detail page**

Create `src/app/[locale]/(admin)/admin/advertisers/[id]/page.tsx`:

```tsx
import { desc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { db } from '@/libs/DB';
import { ads, advertisers } from '@/models/Schema';

function badgeLabel(
  ad: { status: string; active: boolean },
  t: (key: string) => string
): string {
  if (ad.status === 'pending') {
    return t('status_pending');
  }
  if (ad.status === 'rejected') {
    return t('status_rejected');
  }
  if (ad.active) {
    return t('status_approved_active');
  }
  return t('status_approved_paused');
}

export default async function AdminAdvertiserDetailPage(props: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('AdminAdvertiserDetailPage');

  const advertiserId = Number(id);
  if (!Number.isInteger(advertiserId) || advertiserId <= 0) {
    notFound();
  }

  const [advertiser] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.id, advertiserId))
    .limit(1);

  if (!advertiser) {
    notFound();
  }

  const advertiserAds = await db
    .select()
    .from(ads)
    .where(eq(ads.advertiserId, advertiser.id))
    .orderBy(desc(ads.createdAt));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">{advertiser.name}</h1>
      <div className="mt-2 text-sm text-white/50">
        {t('email_label')}: {advertiser.email}
      </div>
      <div className="text-sm text-white/50">
        {t('joined_label')}: {advertiser.createdAt.toISOString().slice(0, 10)}
      </div>

      <h2 className="mt-8 mb-4 text-lg font-semibold">{t('ads_title')}</h2>

      {advertiserAds.length === 0 ? (
        <p className="text-white/50">{t('no_ads')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {advertiserAds.map((ad) => (
            <div
              key={ad.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <span className="truncate">{ad.title}</span>
              <span className="text-xs text-white/60">
                {badgeLabel(ad, t)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `bun run check:types && bun run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/\[locale\]/\(admin\)/admin/advertisers"
git commit -m "feat: add admin advertiser list and detail pages"
```

---

## Task 12: Four status badges on the advertiser ads list

**Files:**
- Modify: `src/app/[locale]/(portal)/advertise/ads/page.tsx:76-86`
- Modify: `src/locales/en.json`, `src/locales/fr.json`

- [ ] **Step 1: Add the new badge i18n keys**

In `src/locales/en.json`, replace the `"status_active"` and `"status_paused"` lines inside the `"AdsPage"` block with these four keys (keep JSON valid):

```json
    "status_pending": "Pending review",
    "status_approved_active": "Active",
    "status_approved_paused": "Paused",
    "status_rejected": "Rejected"
```

Make the same replacement in `src/locales/fr.json`.

- [ ] **Step 2: Replace the status badge cell**

In `src/app/[locale]/(portal)/advertise/ads/page.tsx`, replace the status `<span>` block (currently lines 76-86, the `<span>` containing the conditional badge) with a call to a local `statusBadge` helper. First, add this helper function above the `AdsPage` component (after the imports):

```tsx
function statusBadge(
  ad: { status: string; active: boolean },
  t: (key: string) => string
): { label: string; className: string } {
  if (ad.status === 'pending') {
    return {
      label: t('status_pending'),
      className: 'bg-yellow-500/20 text-yellow-400',
    };
  }
  if (ad.status === 'rejected') {
    return {
      label: t('status_rejected'),
      className: 'bg-red-500/20 text-red-400',
    };
  }
  if (ad.active) {
    return {
      label: t('status_approved_active'),
      className: 'bg-green-500/20 text-green-400',
    };
  }
  return {
    label: t('status_approved_paused'),
    className: 'bg-orange-500/20 text-orange-400',
  };
}
```

Then change the row `.map(...)` to a block body so the badge can be computed once per row. The current map is `advertiserAds.map((ad) => (<div ...>...</div>))`. Change its opening to:

```tsx
          {advertiserAds.map((ad) => {
            const badge = statusBadge(ad, t);
            return (
```

and add a closing `;\n})` where the map's arrow body currently ends (replace the existing `))}` after the row `</div>` with `);\n          })}`).

Within that row, replace the status `<span>` cell (currently lines 76-86) with:

```tsx
              <span>
                <span
                  title={ad.rejectionReason ?? undefined}
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
              </span>
```

- [ ] **Step 3: Type-check, lint, and check i18n**

Run: `bun run check:types && bun run lint && bun run check:i18n`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `bun run test`
Expected: all tests PASS — including `admin`, `ads`, `adActions`, and `adminActions` suites.

- [ ] **Step 5: Commit**

```bash
git add "src/app/\[locale\]/\(portal\)/advertise/ads/page.tsx" src/locales/en.json src/locales/fr.json
git commit -m "feat: show pending and rejected status badges on advertiser ads list"
```

---

## Done

The admin panel is complete:

- `/admin/dashboard` — platform stats with a pending-queue banner
- `/admin/queue` — review queue; approve or reject pending ads
- `/admin/ads` — all ads with a status filter; suspend/unsuspend approved ads
- `/admin/advertisers` and `/admin/advertisers/[id]` — advertiser visibility
- New ads start as `pending` and only serve in search once `approved` + `active`
- Advertisers see Pending review / Active / Paused / Rejected badges on their ads
