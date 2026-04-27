# Advertiser Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-serve advertiser portal at `/advertise/*` with Clerk email+password auth, a local `advertisers` DB table synced on first login, and a skeleton dashboard.

**Architecture:** Clerk provides auth UI and session management. A `clerkMiddleware` in `src/middleware.ts` (combined with next-intl) protects `/[locale]/advertise/dashboard`. On first dashboard load, `ensureAdvertiser()` upserts an `advertisers` row keyed by `clerkUserId`. The portal lives under `src/app/[locale]/(portal)/advertise/`.

**Tech Stack:** `@clerk/nextjs` v5, Drizzle ORM + PostgreSQL, Next.js App Router, next-intl v4, TypeScript, Vitest.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/middleware.ts` | Clerk auth + next-intl locale routing |
| Modify | `src/models/Schema.ts` | Add `advertisers` table + `advertiserId` FK on `ads` |
| Modify | `src/libs/Env.ts` | Add Clerk env vars |
| Modify | `.env.local` | Add Clerk keys (dev) |
| Create | `src/libs/advertisers.ts` | `ensureAdvertiser()` upsert logic |
| Create | `src/libs/advertisers.test.ts` | Idempotency unit test |
| Modify | `src/app/[locale]/layout.tsx` | Wrap with `<ClerkProvider>` |
| Create | `src/app/[locale]/(portal)/advertise/layout.tsx` | Dark nav + `<UserButton />` |
| Create | `src/app/[locale]/(portal)/advertise/sign-in/[[...sign-in]]/page.tsx` | Clerk `<SignIn />` |
| Create | `src/app/[locale]/(portal)/advertise/sign-up/[[...sign-up]]/page.tsx` | Clerk `<SignUp />` |
| Create | `src/app/[locale]/(portal)/advertise/dashboard/page.tsx` | Dashboard: active ads + budget |
| Run | `bun run db:generate` | Generate migration for schema changes |
| Run | `bun run db:migrate` | Apply migration |

---

### Task 1: Install `@clerk/nextjs` and add env vars

**Files:**
- Modify: `src/libs/Env.ts`
- Modify: `.env.local`
- Run: `bun add @clerk/nextjs`

- [ ] **Step 1: Install the package**

```bash
cd /c/Users/skyea/claude/symbolic
bun add @clerk/nextjs
```

Expected: `@clerk/nextjs` appears in `package.json` dependencies.

- [ ] **Step 2: Add Clerk vars to `Env.ts`**

In `src/libs/Env.ts`, add to `server`:
```ts
CLERK_SECRET_KEY: z.string().min(1),
```

Add to `client`:
```ts
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
```

Add to `runtimeEnv`:
```ts
CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
```

Full updated file:

```ts
import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

export const Env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    BRAVE_SEARCH_API_KEY: z.string().min(1),
    BRAVE_API_BASE_URL: z.url().optional(),
    CLERK_SECRET_KEY: z.string().min(1),
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
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
  skipValidation: process.env.NODE_ENV === 'test',
});
```

- [ ] **Step 3: Add Clerk keys to `.env.local`**

Append to `.env.local` (get keys from https://dashboard.clerk.com → your app → API Keys):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/en/advertise/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/en/advertise/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/en/advertise/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/en/advertise/dashboard
```

> Note: `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and related vars are read by Clerk internally — they don't go in `Env.ts`.

- [ ] **Step 4: Verify type-check passes**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock src/libs/Env.ts
git commit -m "feat: install @clerk/nextjs and add env var declarations"
```

---

### Task 2: Create `src/middleware.ts` (Clerk + next-intl combined)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create the middleware file**

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/libs/I18nRouting';

const handleI18nRouting = createIntlMiddleware(routing);

const isProtectedRoute = createRouteMatcher([
  '/:locale/advertise/dashboard(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  return handleI18nRouting(req);
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
```

- [ ] **Step 2: Verify type-check passes**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 3: Start dev server and confirm the site still loads**

```bash
bun run dev
```

Navigate to http://localhost:3000/en — search page should load. Navigate to http://localhost:3000/en/advertise/dashboard — should redirect to Clerk's hosted sign-in (or `/en/advertise/sign-in` once that page exists).

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add Clerk + next-intl combined middleware"
```

---

### Task 3: Add `advertisers` table and `advertiserId` FK to schema

**Files:**
- Modify: `src/models/Schema.ts`
- Run: `bun run db:generate` then `bun run db:migrate`

- [ ] **Step 1: Update `Schema.ts`**

Add `advertisers` table and `advertiserId` column on `ads`. Full updated file:

```ts
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const counterSchema = pgTable('counter', {
  id: serial('id').primaryKey(),
  count: integer('count').default(0),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const advertisers = pgTable('advertisers', {
  id: serial('id').primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

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
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const adClicks = pgTable('ad_clicks', {
  id: serial('id').primaryKey(),
  adId: integer('ad_id')
    .notNull()
    .references(() => ads.id),
  query: text('query').notNull(),
  clickedAt: timestamp('clicked_at').notNull().defaultNow(),
});
```

- [ ] **Step 2: Generate migration**

```bash
bun run db:generate
```

Expected: new file created in `migrations/` like `0002_advertisers.sql`.

- [ ] **Step 3: Apply migration**

```bash
bun run db:migrate
```

Expected: `Applying migration 0002_...` in output, no errors.

- [ ] **Step 4: Verify type-check**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/models/Schema.ts migrations/
git commit -m "feat: add advertisers table and advertiserId FK on ads"
```

---

### Task 4: Create `ensureAdvertiser()` with idempotency test

**Files:**
- Create: `src/libs/advertisers.ts`
- Create: `src/libs/advertisers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/libs/advertisers.test.ts`:

```ts
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from './DB';
import { advertisers } from '@/models/Schema';
import { ensureAdvertiser } from './advertisers';

describe('ensureAdvertiser', () => {
  const testClerkId = 'test_clerk_idempotency_001';

  afterEach(async () => {
    await db.delete(advertisers).where(eq(advertisers.clerkUserId, testClerkId));
  });

  it('creates exactly one row when called twice with the same clerkUserId', async () => {
    await ensureAdvertiser(testClerkId, 'test@example.com', 'Test User');
    await ensureAdvertiser(testClerkId, 'test@example.com', 'Test User');

    const rows = await db
      .select()
      .from(advertisers)
      .where(eq(advertisers.clerkUserId, testClerkId));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.email).toBe('test@example.com');
    expect(rows[0]!.name).toBe('Test User');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
bun run test src/libs/advertisers.test.ts
```

Expected: FAIL — `Cannot find module './advertisers'`.

- [ ] **Step 3: Create `src/libs/advertisers.ts`**

```ts
import { advertisers } from '@/models/Schema';
import { db } from './DB';

/**
 * Upserts an advertisers row for the given Clerk user.
 * Safe to call multiple times — creates on first call, no-ops thereafter.
 */
export async function ensureAdvertiser(
  clerkUserId: string,
  email: string,
  name: string,
): Promise<void> {
  await db
    .insert(advertisers)
    .values({ clerkUserId, email, name })
    .onConflictDoNothing({ target: advertisers.clerkUserId });
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
bun run test src/libs/advertisers.test.ts
```

Expected: PASS — `creates exactly one row when called twice`.

- [ ] **Step 5: Run full test suite**

```bash
bun run test
```

Expected: all tests pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/libs/advertisers.ts src/libs/advertisers.test.ts
git commit -m "feat: add ensureAdvertiser upsert with idempotency test"
```

---

### Task 5: Add `<ClerkProvider>` to root layout

**Files:**
- Modify: `src/app/[locale]/layout.tsx`

- [ ] **Step 1: Update root layout**

```tsx
import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/libs/I18nRouting';
import '@/styles/global.css';

export const metadata: Metadata = {
  title: {
    template: '%s | Symbolic',
    default: 'Symbolic — Search without compromise',
  },
  description:
    'Symbolic is a privacy-respecting search engine powered by Brave Search.',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <ClerkProvider>
      <html lang={locale}>
        <body>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Verify type-check**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/layout.tsx
git commit -m "feat: wrap root layout with ClerkProvider"
```

---

### Task 6: Create portal layout

**Files:**
- Create: `src/app/[locale]/(portal)/advertise/layout.tsx`

- [ ] **Step 1: Create the directory and layout file**

```tsx
import { UserButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';

export default function AdvertiseLayout(props: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d0d14] text-white">
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <Link href="/advertise/dashboard" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Symbolic" width={100} height={44} />
          <span className="text-sm font-semibold tracking-wide text-white/60">
            Ads
          </span>
        </Link>
        <UserButton afterSignOutUrl="/en/advertise/sign-in" />
      </nav>
      <main>{props.children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/(portal)/advertise/layout.tsx
git commit -m "feat: add advertiser portal layout with dark nav and UserButton"
```

---

### Task 7: Create sign-in and sign-up pages

**Files:**
- Create: `src/app/[locale]/(portal)/advertise/sign-in/[[...sign-in]]/page.tsx`
- Create: `src/app/[locale]/(portal)/advertise/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Create sign-in page**

```tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center">
      <SignIn afterSignInUrl="/en/advertise/dashboard" />
    </div>
  );
}
```

- [ ] **Step 2: Create sign-up page**

```tsx
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center">
      <SignUp afterSignUpUrl="/en/advertise/dashboard" />
    </div>
  );
}
```

- [ ] **Step 3: Verify type-check**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 4: Smoke test in browser**

Start dev server: `bun run dev`

Navigate to http://localhost:3000/en/advertise/sign-in — Clerk SignIn component should render with email + password fields.

Navigate to http://localhost:3000/en/advertise/sign-up — Clerk SignUp component should render.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/(portal)/advertise/sign-in/ src/app/[locale]/(portal)/advertise/sign-up/
git commit -m "feat: add advertiser sign-in and sign-up pages with Clerk components"
```

---

### Task 8: Create dashboard page

**Files:**
- Create: `src/app/[locale]/(portal)/advertise/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page**

This server component calls `ensureAdvertiser()` then shows active ad count and budget.

```tsx
import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import { ensureAdvertiser } from '@/libs/advertisers';
import { ads, advertisers } from '@/models/Schema';

export const metadata = { title: 'Dashboard — Symbolic Ads' };

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) {
    redirect('/en/advertise/sign-in');
  }

  const email = user.emailAddresses[0]?.emailAddress ?? '';
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || email;

  await ensureAdvertiser(user.id, email, name);

  const [advertiser] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, user.id))
    .limit(1);

  const activeAdsRows = advertiser
    ? await db
        .select({ id: ads.id })
        .from(ads)
        .where(eq(ads.advertiserId, advertiser.id))
    : [];

  const activeAdsCount = activeAdsRows.length;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">
        Welcome, {name} 👋
      </h1>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">Active ads</p>
          <p className="text-3xl font-bold">{activeAdsCount}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">Budget</p>
          <p className="text-3xl font-bold">£0</p>
        </div>
      </div>

      <button
        disabled
        type="button"
        className="w-full cursor-not-allowed rounded-lg bg-indigo-600/40 px-4 py-3 text-sm font-semibold text-white/50"
      >
        + Create your first ad (coming soon)
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 3: Full end-to-end smoke test**

Start dev server: `bun run dev`

1. Navigate to http://localhost:3000/en/advertise/dashboard
2. Should redirect to sign-in (middleware protection)
3. Sign up with a test email — Clerk sends verification email
4. Verify email → lands on dashboard
5. Dashboard shows "Welcome, [Name] 👋", Active ads: 0, Budget: £0
6. "Create your first ad" button is visible but greyed/disabled
7. Sign out via the UserButton in the nav → redirects to sign-in

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/(portal)/advertise/dashboard/page.tsx
git commit -m "feat: add advertiser dashboard with active ads count and budget"
```

---

### Task 9: Add Clerk env vars to VPS and redeploy

**Files:**
- VPS `/var/www/symbolic/.env.local` (edit via SSH)

- [ ] **Step 1: Add Clerk keys to VPS `.env.local`**

SSH into the VPS and append Clerk keys. Get the **production** keys from https://dashboard.clerk.com → switch to Production instance → API Keys.

```bash
# SSH into VPS
ssh root@5.231.107.100

# Append Clerk vars
cat >> /var/www/symbolic/.env.local << 'EOF'
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/en/advertise/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/en/advertise/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/en/advertise/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/en/advertise/dashboard
EOF
```

- [ ] **Step 2: Pull latest code and rebuild on VPS**

```bash
cd /var/www/symbolic
git pull origin main
bun install
bun run build
pm2 restart symbolic
```

- [ ] **Step 3: Smoke test production**

Navigate to http://5.231.107.100/en/advertise/sign-up — Clerk sign-up page should appear.

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|------------------|------|
| Portal at `/advertise/*` | Tasks 6, 7, 8 |
| Clerk email + password auth | Tasks 1, 7 |
| Email verification → dashboard | Task 7 (Clerk handles) |
| `advertisers` DB table | Task 3 |
| `ads.advertiser_id` nullable FK | Task 3 |
| Middleware protects `/advertise/dashboard` | Task 2 |
| Public sign-in / sign-up routes | Tasks 2, 7 |
| `ensureAdvertiser` idempotent upsert | Task 4 |
| Dashboard: name, active ads, £0 budget, disabled CTA | Task 8 |
| Portal layout: dark nav, logo, `<UserButton />` | Task 6 |
| Env vars | Tasks 1, 9 |
| Unit test for idempotency | Task 4 |
| Error handling (DB failure → 500) | `ensureAdvertiser` throws; Next.js catches → 500 |

### Placeholder scan

No TBDs, TODOs, or vague steps found.

### Type consistency

- `ensureAdvertiser(clerkUserId, email, name)` — same signature in Tasks 4 and 8.
- `advertisers.clerkUserId` — snake_case in DB (`clerk_user_id`), camelCase in Drizzle (`clerkUserId`) — consistent throughout.
- `ads.advertiserId` — nullable integer, matches `references(() => advertisers.id)` pattern.
