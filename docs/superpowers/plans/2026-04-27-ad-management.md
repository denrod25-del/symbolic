# Ad Management Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-serve ad management portal where advertisers can create, edit, pause/resume, and delete their own ads through a 3-step wizard and an ads list page.

**Architecture:** Server components for reads (ads list page), client component for the wizard, four server actions (`createAd`, `updateAd`, `toggleAdActive`, `deleteAd`) in `src/libs/adActions.ts`. A thin `AdRowActions` client component handles interactive per-row buttons (pause/resume + delete confirm) embedded in the server-rendered list.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind v4, Drizzle ORM (PostgreSQL/PGLite), `@clerk/nextjs` v7 (`currentUser()`), Zod v4, Vitest (unit tests with real PGLite DB + mocked Clerk).

---

## Important: actual DB schema field names

The `ads` table (in `src/models/Schema.ts`) uses these Drizzle field names — use them exactly:

| Form label | Drizzle field | Type | Notes |
|---|---|---|---|
| Headline | `title` | `text, notNull` | max 80 |
| Destination URL | `url` | `text, notNull` | valid URL |
| Display URL | `displayUrl` | `text, notNull` | max 60 |
| Description | `description` | `text, notNull` | max 200, optional in UI |
| CTA text | `ctaText` | `text, notNull` | max 30 |
| Keywords | `keywords` | `text[], notNull` | stored as array |
| Bid | `bidAmount` | `integer, notNull` | stored as pence (£1.00 = 100) |
| Status | `active` | `boolean, notNull, default true` | |
| — | `advertiserId` | `integer, FK advertisers.id` | nullable |
| — | `advertiserName` | `text, notNull` | copy from `advertisers.name` at insert |

The wizard input for `keywords` is a comma-separated string that gets split into an array. The wizard input for bid is a `£` amount (string) that gets multiplied by 100 and rounded to pence.

---

## File map

| File | Action | Purpose |
|---|---|---|
| `src/middleware.ts` | Modify | Add `/advertise/ads` and `/advertise/create` to protected routes |
| `src/libs/adActions.ts` | Create | `'use server'` — 4 server actions + Zod schema |
| `src/libs/adActions.test.ts` | Create | Unit tests — mock Clerk, use real PGLite DB |
| `src/components/AdWizard.tsx` | Create | `'use client'` — 3-step wizard for create/edit |
| `src/app/[locale]/(portal)/advertise/create/page.tsx` | Create | Create page — renders `<AdWizard>` |
| `src/app/[locale]/(portal)/advertise/ads/AdRowActions.tsx` | Create | `'use client'` — per-row pause/resume + delete buttons |
| `src/app/[locale]/(portal)/advertise/ads/page.tsx` | Create | Ads list — server component |
| `src/app/[locale]/(portal)/advertise/ads/[id]/edit/page.tsx` | Create | Edit page — fetches ad, renders `<AdWizard initialData={...}>` |
| `src/app/[locale]/(portal)/advertise/layout.tsx` | Modify | Add "My Ads" nav link |
| `src/app/[locale]/(portal)/advertise/dashboard/page.tsx` | Modify | Enable CTA button, link to `/advertise/create` |

---

## Task 1: Extend middleware to protect new routes

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update `isProtectedRoute` matcher**

Open `src/middleware.ts`. Replace:

```ts
const isProtectedRoute = createRouteMatcher([
  '/:locale/advertise/dashboard(.*)',
]);
```

With:

```ts
const isProtectedRoute = createRouteMatcher([
  '/:locale/advertise/dashboard(.*)',
  '/:locale/advertise/ads(.*)',
  '/:locale/advertise/create(.*)',
]);
```

- [ ] **Step 2: Verify types still pass**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: protect /advertise/ads and /advertise/create routes"
```

---

## Task 2: Server actions — write failing tests first

**Files:**
- Create: `src/libs/adActions.test.ts`
- Create: `src/libs/adActions.ts` (skeleton to make imports resolve)

- [ ] **Step 1: Create a skeleton `adActions.ts` so imports resolve**

Create `src/libs/adActions.ts`:

```ts
'use server';

export async function createAd(_data: unknown): Promise<{ success: true } | { error: string }> {
  throw new Error('not implemented');
}

export async function updateAd(_id: number, _data: unknown): Promise<{ success: true } | { error: string }> {
  throw new Error('not implemented');
}

export async function toggleAdActive(_id: number, _locale: string): Promise<{ error: string } | void> {
  throw new Error('not implemented');
}

export async function deleteAd(_id: number, _locale: string): Promise<{ error: string } | void> {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Create `src/libs/adActions.test.ts` with all tests**

```ts
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ads, advertisers } from '@/models/Schema';
import { db } from './DB';
import { createAd, deleteAd, toggleAdActive, updateAd } from './adActions';

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
}));

// Import after mock so the mock is in place
const { currentUser } = await import('@clerk/nextjs/server');
const mockCurrentUser = vi.mocked(currentUser);

const validData = {
  title: 'Best running shoes',
  url: 'https://example.com/shoes',
  displayUrl: 'example.com/shoes',
  description: 'Top quality shoes for runners.',
  ctaText: 'Shop Now',
  keywords: 'running, shoes, trainers',
  bidPounds: '0.50',
};

describe('adActions', () => {
  let clerkId: string;
  let advertiserId: number;

  beforeEach(async () => {
    clerkId = `test_${crypto.randomUUID()}`;
    const [adv] = await db
      .insert(advertisers)
      .values({ clerkUserId: clerkId, email: 'test@example.com', name: 'Test Advertiser' })
      .returning();
    advertiserId = adv!.id;
    mockCurrentUser.mockResolvedValue({ id: clerkId } as never);
  });

  afterEach(async () => {
    await db.delete(ads).where(eq(ads.advertiserId, advertiserId));
    await db.delete(advertisers).where(eq(advertisers.id, advertiserId));
    vi.clearAllMocks();
  });

  describe('createAd', () => {
    it('inserts an ad row and returns success', async () => {
      const result = await createAd(validData);

      expect(result).toEqual({ success: true });

      const rows = await db.select().from(ads).where(eq(ads.advertiserId, advertiserId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.title).toBe('Best running shoes');
      expect(rows[0]?.bidAmount).toBe(50); // £0.50 = 50 pence
      expect(rows[0]?.keywords).toEqual(['running', 'shoes', 'trainers']);
      expect(rows[0]?.active).toBe(true);
    });

    it('returns error for invalid URL', async () => {
      const result = await createAd({ ...validData, url: 'not-a-url' });

      expect(result).toHaveProperty('error');
      const rows = await db.select().from(ads).where(eq(ads.advertiserId, advertiserId));
      expect(rows).toHaveLength(0);
    });

    it('returns error for bid below minimum (£0.10 = 10 pence)', async () => {
      const result = await createAd({ ...validData, bidPounds: '0.05' });

      expect(result).toHaveProperty('error');
      const rows = await db.select().from(ads).where(eq(ads.advertiserId, advertiserId));
      expect(rows).toHaveLength(0);
    });
  });

  describe('updateAd', () => {
    it('updates the ad and returns success', async () => {
      const [ad] = await db
        .insert(ads)
        .values({
          advertiserId,
          advertiserName: 'Test Advertiser',
          title: 'Old title',
          url: 'https://old.com',
          displayUrl: 'old.com',
          description: '',
          ctaText: 'Click',
          keywords: ['old'],
          bidAmount: 20,
          active: true,
        })
        .returning();

      const result = await updateAd(ad!.id, { ...validData, title: 'New title' });

      expect(result).toEqual({ success: true });

      const [updated] = await db.select().from(ads).where(eq(ads.id, ad!.id));
      expect(updated?.title).toBe('New title');
    });

    it('returns error when ad belongs to another advertiser', async () => {
      // Create a second advertiser
      const otherId = `test_${crypto.randomUUID()}`;
      const [other] = await db
        .insert(advertisers)
        .values({ clerkUserId: otherId, email: 'other@example.com', name: 'Other' })
        .returning();

      const [ad] = await db
        .insert(ads)
        .values({
          advertiserId: other!.id,
          advertiserName: 'Other',
          title: 'Not yours',
          url: 'https://other.com',
          displayUrl: 'other.com',
          description: '',
          ctaText: 'Go',
          keywords: ['other'],
          bidAmount: 10,
          active: true,
        })
        .returning();

      // Current user is clerkId (not otherId)
      const result = await updateAd(ad!.id, validData);
      expect(result).toHaveProperty('error');

      // Cleanup
      await db.delete(ads).where(eq(ads.id, ad!.id));
      await db.delete(advertisers).where(eq(advertisers.id, other!.id));
    });
  });

  describe('toggleAdActive', () => {
    it('flips active from true to false', async () => {
      const [ad] = await db
        .insert(ads)
        .values({
          advertiserId,
          advertiserName: 'Test Advertiser',
          title: 'Toggle me',
          url: 'https://example.com',
          displayUrl: 'example.com',
          description: '',
          ctaText: 'Click',
          keywords: ['test'],
          bidAmount: 10,
          active: true,
        })
        .returning();

      await toggleAdActive(ad!.id, 'en');

      const [updated] = await db.select().from(ads).where(eq(ads.id, ad!.id));
      expect(updated?.active).toBe(false);
    });

    it('flips active from false to true', async () => {
      const [ad] = await db
        .insert(ads)
        .values({
          advertiserId,
          advertiserName: 'Test Advertiser',
          title: 'Resume me',
          url: 'https://example.com',
          displayUrl: 'example.com',
          description: '',
          ctaText: 'Click',
          keywords: ['test'],
          bidAmount: 10,
          active: false,
        })
        .returning();

      await toggleAdActive(ad!.id, 'en');

      const [updated] = await db.select().from(ads).where(eq(ads.id, ad!.id));
      expect(updated?.active).toBe(true);
    });
  });

  describe('deleteAd', () => {
    it('removes the ad row', async () => {
      const [ad] = await db
        .insert(ads)
        .values({
          advertiserId,
          advertiserName: 'Test Advertiser',
          title: 'Delete me',
          url: 'https://example.com',
          displayUrl: 'example.com',
          description: '',
          ctaText: 'Click',
          keywords: ['test'],
          bidAmount: 10,
          active: true,
        })
        .returning();

      await deleteAd(ad!.id, 'en');

      const rows = await db.select().from(ads).where(eq(ads.id, ad!.id));
      expect(rows).toHaveLength(0);
    });

    it('does not delete an ad owned by another advertiser', async () => {
      const otherId = `test_${crypto.randomUUID()}`;
      const [other] = await db
        .insert(advertisers)
        .values({ clerkUserId: otherId, email: 'other2@example.com', name: 'Other2' })
        .returning();

      const [ad] = await db
        .insert(ads)
        .values({
          advertiserId: other!.id,
          advertiserName: 'Other2',
          title: 'Not yours',
          url: 'https://other2.com',
          displayUrl: 'other2.com',
          description: '',
          ctaText: 'Go',
          keywords: ['x'],
          bidAmount: 10,
          active: true,
        })
        .returning();

      await deleteAd(ad!.id, 'en');

      // Ad should still exist because it belongs to another advertiser
      const rows = await db.select().from(ads).where(eq(ads.id, ad!.id));
      expect(rows).toHaveLength(1);

      // Cleanup
      await db.delete(ads).where(eq(ads.id, ad!.id));
      await db.delete(advertisers).where(eq(advertisers.id, other!.id));
    });
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
bun run test --reporter=verbose src/libs/adActions.test.ts
```

Expected: all tests FAIL with "not implemented".

---

## Task 3: Server actions — implement

**Files:**
- Modify: `src/libs/adActions.ts`

- [ ] **Step 1: Replace the skeleton with the full implementation**

Overwrite `src/libs/adActions.ts`:

```ts
'use server';

import { currentUser } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { ads, advertisers } from '@/models/Schema';
import { db } from './DB';

const adFormSchema = z.object({
  title: z.string().min(1).max(80),
  url: z.string().url(),
  displayUrl: z.string().min(1).max(60),
  description: z.string().max(200).default(''),
  ctaText: z.string().min(1).max(30),
  keywords: z.string().min(1),
  bidPounds: z.coerce.number().min(0.10),
});

type AdFormData = z.infer<typeof adFormSchema>;

async function getAdvertiser(clerkUserId: string) {
  const [row] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, clerkUserId))
    .limit(1);
  return row ?? null;
}

function parseKeywords(raw: string): string[] {
  return raw.split(',').map(k => k.trim()).filter(Boolean);
}

/** Creates a new ad for the signed-in advertiser. */
export async function createAd(data: AdFormData): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = adFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const advertiser = await getAdvertiser(user.id);
  if (!advertiser) return { error: 'Advertiser account not found' };

  const { title, url, displayUrl, description, ctaText, keywords, bidPounds } = parsed.data;

  await db.insert(ads).values({
    advertiserId: advertiser.id,
    advertiserName: advertiser.name,
    title,
    url,
    displayUrl,
    description,
    ctaText,
    keywords: parseKeywords(keywords),
    bidAmount: Math.round(bidPounds * 100),
    active: true,
  });

  return { success: true };
}

/** Updates an existing ad. Verifies ownership before updating. */
export async function updateAd(
  id: number,
  data: AdFormData,
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) return { error: 'Not authenticated' };

  const parsed = adFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const advertiser = await getAdvertiser(user.id);
  if (!advertiser) return { error: 'Advertiser account not found' };

  const { title, url, displayUrl, description, ctaText, keywords, bidPounds } = parsed.data;

  const updated = await db
    .update(ads)
    .set({
      title,
      url,
      displayUrl,
      description,
      ctaText,
      keywords: parseKeywords(keywords),
      bidAmount: Math.round(bidPounds * 100),
    })
    .where(and(eq(ads.id, id), eq(ads.advertiserId, advertiser.id)))
    .returning({ id: ads.id });

  if (updated.length === 0) return { error: 'Ad not found' };

  return { success: true };
}

/** Flips the active flag on an ad. Verifies ownership first. */
export async function toggleAdActive(id: number, locale: string): Promise<{ error: string } | void> {
  const user = await currentUser();
  if (!user) return { error: 'Not authenticated' };

  const advertiser = await getAdvertiser(user.id);
  if (!advertiser) return { error: 'Advertiser account not found' };

  const [ad] = await db
    .select({ active: ads.active })
    .from(ads)
    .where(and(eq(ads.id, id), eq(ads.advertiserId, advertiser.id)))
    .limit(1);

  if (!ad) return { error: 'Ad not found' };

  await db
    .update(ads)
    .set({ active: !ad.active })
    .where(and(eq(ads.id, id), eq(ads.advertiserId, advertiser.id)));

  revalidatePath(`/${locale}/advertise/ads`);
}

/** Deletes an ad. Verifies ownership before deleting. */
export async function deleteAd(id: number, locale: string): Promise<{ error: string } | void> {
  const user = await currentUser();
  if (!user) return { error: 'Not authenticated' };

  const advertiser = await getAdvertiser(user.id);
  if (!advertiser) return { error: 'Advertiser account not found' };

  const [ad] = await db
    .select({ id: ads.id })
    .from(ads)
    .where(and(eq(ads.id, id), eq(ads.advertiserId, advertiser.id)))
    .limit(1);

  if (!ad) return;

  await db.delete(ads).where(eq(ads.id, id));

  revalidatePath(`/${locale}/advertise/ads`);
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
bun run test --reporter=verbose src/libs/adActions.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 3: Run full type check**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/libs/adActions.ts src/libs/adActions.test.ts
git commit -m "feat: add createAd, updateAd, toggleAdActive, deleteAd server actions"
```

---

## Task 4: AdWizard client component

**Files:**
- Create: `src/components/AdWizard.tsx`

- [ ] **Step 1: Create `src/components/AdWizard.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAd, updateAd } from '@/libs/adActions';

type WizardData = {
  title: string;
  url: string;
  displayUrl: string;
  description: string;
  ctaText: string;
  keywords: string;
  bidPounds: string;
};

type AdWizardProps = {
  locale: string;
  initialData?: {
    id: number;
    title: string;
    url: string;
    displayUrl: string;
    description: string;
    ctaText: string;
    keywords: string[];
    bidAmount: number;
  };
};

const STEPS = [
  { num: 1, label: '1. Content' },
  { num: 2, label: '2. Keywords' },
  { num: 3, label: '3. Bid' },
] as const;

export function AdWizard(props: AdWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [data, setData] = useState<WizardData>(() =>
    props.initialData
      ? {
          title: props.initialData.title,
          url: props.initialData.url,
          displayUrl: props.initialData.displayUrl,
          description: props.initialData.description,
          ctaText: props.initialData.ctaText,
          keywords: props.initialData.keywords.join(', '),
          bidPounds: (props.initialData.bidAmount / 100).toFixed(2),
        }
      : {
          title: '',
          url: '',
          displayUrl: '',
          description: '',
          ctaText: '',
          keywords: '',
          bidPounds: '0.50',
        }
  );

  function set(field: keyof WizardData, value: string) {
    setData(prev => ({ ...prev, [field]: value }));
  }

  async function handlePublish() {
    setError(null);
    setPending(true);
    try {
      const payload = {
        title: data.title,
        url: data.url,
        displayUrl: data.displayUrl,
        description: data.description,
        ctaText: data.ctaText,
        keywords: data.keywords,
        bidPounds: data.bidPounds,
      };

      const result = props.initialData
        ? await updateAd(props.initialData.id, payload)
        : await createAd(payload);

      if (result && 'error' in result) {
        setError(result.error);
      } else {
        router.push(`/${props.locale}/advertise/ads`);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">
        {props.initialData ? 'Edit ad' : 'Create ad'}
      </h1>

      {/* Step indicator */}
      <div className="mb-8 flex gap-2">
        {STEPS.map(s => (
          <span
            key={s.num}
            className={`rounded px-3 py-1 text-sm font-medium ${
              step === s.num
                ? 'bg-indigo-600 text-white'
                : 'bg-white/5 text-white/40'
            }`}
          >
            {s.label}
          </span>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Step 1: Content */}
      {step === 1 && (
        <div className="space-y-4">
          <Field
            label="Headline"
            value={data.title}
            onChange={v => set('title', v)}
            placeholder='e.g. "Best running shoes 2026"'
            maxLength={80}
          />
          <Field
            label="Destination URL"
            value={data.url}
            onChange={v => set('url', v)}
            placeholder="https://..."
          />
          <Field
            label="Display URL"
            value={data.displayUrl}
            onChange={v => set('displayUrl', v)}
            placeholder='e.g. "myshop.com/shoes"'
            maxLength={60}
          />
          <Field
            label="Description"
            value={data.description}
            onChange={v => set('description', v)}
            placeholder="1–2 sentences about your ad"
            maxLength={200}
          />
          <Field
            label="CTA text"
            value={data.ctaText}
            onChange={v => set('ctaText', v)}
            placeholder='e.g. "Shop Now"'
            maxLength={30}
          />
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold hover:bg-indigo-500"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Keywords */}
      {step === 2 && (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-white/60">Keywords</span>
            <p className="mb-2 text-xs text-white/40">
              Enter keywords that trigger your ad on search results. Separate with commas.
            </p>
            <textarea
              value={data.keywords}
              onChange={e => set('keywords', e.target.value)}
              rows={3}
              placeholder="running shoes, trainers, nike, sports footwear"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg bg-white/5 px-6 py-2 text-sm font-semibold hover:bg-white/10"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold hover:bg-indigo-500"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Bid */}
      {step === 3 && (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-white/60">Bid per click</span>
            <p className="mb-2 text-xs text-white/40">
              Set how much you pay per click. Higher bids rank above lower bids.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-white/50">£</span>
              <input
                type="number"
                step="0.01"
                min="0.10"
                value={data.bidPounds}
                onChange={e => set('bidPounds', e.target.value)}
                className="w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-sm text-white/40">per click</span>
            </div>
            <p className="mt-1 text-xs text-white/30">Minimum £0.10 per click</p>
          </label>
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg bg-white/5 px-6 py-2 text-sm font-semibold hover:bg-white/10"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={pending}
              className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
            >
              {pending
                ? 'Saving...'
                : props.initialData
                  ? 'Save changes ✓'
                  : 'Publish ad ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-white/60">{props.label}</span>
      <input
        type="text"
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </label>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdWizard.tsx
git commit -m "feat: add AdWizard 3-step client component"
```

---

## Task 5: Create page

**Files:**
- Create: `src/app/[locale]/(portal)/advertise/create/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/[locale]/(portal)/advertise/create/page.tsx`:

```tsx
import { AdWizard } from '@/components/AdWizard';

export default async function CreatePage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  return <AdWizard locale={locale} />;
}
```

- [ ] **Step 2: Type-check**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/\[locale\]/\(portal\)/advertise/create/page.tsx"
git commit -m "feat: add /advertise/create page"
```

---

## Task 6: AdRowActions client component

**Files:**
- Create: `src/app/[locale]/(portal)/advertise/ads/AdRowActions.tsx`

- [ ] **Step 1: Create `AdRowActions.tsx`**

Create `src/app/[locale]/(portal)/advertise/ads/AdRowActions.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteAd, toggleAdActive } from '@/libs/adActions';

type AdRowActionsProps = {
  adId: number;
  isActive: boolean;
  locale: string;
};

export function AdRowActions(props: AdRowActionsProps) {
  const router = useRouter();

  async function handleToggle() {
    await toggleAdActive(props.adId, props.locale);
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm('Delete this ad? This cannot be undone.')) return;
    await deleteAd(props.adId, props.locale);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/${props.locale}/advertise/ads/${props.adId}/edit`}
        className="text-sm text-indigo-400 hover:underline"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={handleToggle}
        className="text-sm text-white/50 hover:text-white"
      >
        {props.isActive ? 'Pause' : 'Resume'}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="text-sm text-red-400 hover:text-red-300"
      >
        Delete
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/\[locale\]/\(portal\)/advertise/ads/AdRowActions.tsx"
git commit -m "feat: add AdRowActions client component for ad list"
```

---

## Task 7: Ads list page

**Files:**
- Create: `src/app/[locale]/(portal)/advertise/ads/page.tsx`

- [ ] **Step 1: Create `src/app/[locale]/(portal)/advertise/ads/page.tsx`**

```tsx
import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdRowActions } from './AdRowActions';
import { db } from '@/libs/DB';
import { ads, advertisers } from '@/models/Schema';

export default async function AdsPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  const user = await currentUser();
  if (!user) redirect(`/${locale}/advertise/sign-in`);

  const [advertiser] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, user.id))
    .limit(1);

  const advertiserAds = advertiser
    ? await db.select().from(ads).where(eq(ads.advertiserId, advertiser.id))
    : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Ads</h1>
        <Link
          href={`/${locale}/advertise/create`}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500"
        >
          + Create ad
        </Link>
      </div>

      {advertiserAds.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 px-6 py-16 text-center">
          <p className="mb-4 text-white/50">No ads yet — create your first one</p>
          <Link
            href={`/${locale}/advertise/create`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500"
          >
            Create ad
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="grid grid-cols-[2fr_1fr_80px_100px_160px] gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">
            <span>Headline</span>
            <span>Keywords</span>
            <span>Bid</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {advertiserAds.map(ad => (
            <div
              key={ad.id}
              className="grid grid-cols-[2fr_1fr_80px_100px_160px] items-center gap-4 border-b border-white/5 px-4 py-3 text-sm last:border-0"
            >
              <span className="truncate">{ad.title}</span>
              <span className="truncate text-white/50">
                {ad.keywords.slice(0, 3).join(', ')}
                {ad.keywords.length > 3 ? '…' : ''}
              </span>
              <span>£{(ad.bidAmount / 100).toFixed(2)}</span>
              <span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    ad.active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}
                >
                  {ad.active ? 'Active' : 'Paused'}
                </span>
              </span>
              <AdRowActions adId={ad.id} isActive={ad.active} locale={locale} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/\[locale\]/\(portal\)/advertise/ads/page.tsx"
git commit -m "feat: add /advertise/ads list page"
```

---

## Task 8: Edit page

**Files:**
- Create: `src/app/[locale]/(portal)/advertise/ads/[id]/edit/page.tsx`

- [ ] **Step 1: Create the edit page**

Create `src/app/[locale]/(portal)/advertise/ads/[id]/edit/page.tsx`:

```tsx
import { currentUser } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { AdWizard } from '@/components/AdWizard';
import { db } from '@/libs/DB';
import { ads, advertisers } from '@/models/Schema';

export default async function EditPage(props: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await props.params;
  const user = await currentUser();
  if (!user) redirect(`/${locale}/advertise/sign-in`);

  const [advertiser] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, user.id))
    .limit(1);

  if (!advertiser) redirect(`/${locale}/advertise/sign-in`);

  const adId = Number(id);
  const [ad] = await db
    .select()
    .from(ads)
    .where(and(eq(ads.id, adId), eq(ads.advertiserId, advertiser.id)))
    .limit(1);

  if (!ad) notFound();

  return (
    <AdWizard
      locale={locale}
      initialData={{
        id: ad.id,
        title: ad.title,
        url: ad.url,
        displayUrl: ad.displayUrl,
        description: ad.description,
        ctaText: ad.ctaText,
        keywords: ad.keywords,
        bidAmount: ad.bidAmount,
      }}
    />
  );
}
```

- [ ] **Step 2: Type-check**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/\[locale\]/\(portal\)/advertise/ads/\[id\]/edit/page.tsx"
git commit -m "feat: add /advertise/ads/[id]/edit page"
```

---

## Task 9: Navigation and dashboard CTA

**Files:**
- Modify: `src/app/[locale]/(portal)/advertise/layout.tsx`
- Modify: `src/app/[locale]/(portal)/advertise/dashboard/page.tsx`

- [ ] **Step 1: Add "My Ads" nav link to portal layout**

Open `src/app/[locale]/(portal)/advertise/layout.tsx`. The current nav has a logo `<Link>` and a `<UserButton />`. Add nav links between them.

Replace:

```tsx
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <Link
          href={`/${locale}/advertise/dashboard`}
          className="flex items-center gap-3"
        >
          <Image src="/logo.png" alt="Symbolic" width={100} height={44} />
          <span className="text-sm font-semibold tracking-wide text-white/60">
            Ads
          </span>
        </Link>
        <UserButton />
      </nav>
```

With:

```tsx
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-8">
          <Link
            href={`/${locale}/advertise/dashboard`}
            className="flex items-center gap-3"
          >
            <Image src="/logo.png" alt="Symbolic" width={100} height={44} />
            <span className="text-sm font-semibold tracking-wide text-white/60">
              Ads
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href={`/${locale}/advertise/dashboard`}
              className="text-sm text-white/60 hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href={`/${locale}/advertise/ads`}
              className="text-sm text-white/60 hover:text-white"
            >
              My Ads
            </Link>
          </div>
        </div>
        <UserButton />
      </nav>
```

- [ ] **Step 2: Enable dashboard CTA button**

Open `src/app/[locale]/(portal)/advertise/dashboard/page.tsx`. Replace the disabled button:

```tsx
      <button
        disabled
        type="button"
        className="w-full cursor-not-allowed rounded-lg bg-indigo-600/40 px-4 py-3 text-sm font-semibold text-white/50"
      >
        + Create your first ad (coming soon)
      </button>
```

With:

```tsx
      <Link
        href={`/${locale}/advertise/create`}
        className="block w-full rounded-lg bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-500"
      >
        + Create your first ad
      </Link>
```

Also add the `Link` import at the top of the file if it isn't already there:

```ts
import Link from 'next/link';
```

- [ ] **Step 3: Type-check**

```bash
bun run check:types
```

Expected: no errors.

- [ ] **Step 4: Run all tests to confirm nothing broken**

```bash
bun run test
```

Expected: all tests PASS (including adActions tests from Task 3).

- [ ] **Step 5: Commit**

```bash
git add src/app/\[locale\]/\(portal\)/advertise/layout.tsx src/app/\[locale\]/\(portal\)/advertise/dashboard/page.tsx
git commit -m "feat: add My Ads nav link and enable dashboard create CTA"
```

---

## Done

All tasks complete. The ad management portal is fully functional:

- `/advertise/ads` — lists all ads with Active/Paused badges and Edit/Pause/Delete actions
- `/advertise/create` — 3-step wizard (content → keywords → bid) creates a new ad
- `/advertise/ads/[id]/edit` — same wizard pre-filled for editing
- All writes go through ownership-verified server actions with Zod validation
- All new routes are auth-protected via middleware
