# Symbolic Phase 2: Ad Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a keyword-targeted CPC ad system that shows rich ad cards above and below search results, tracking clicks via a secure server-side route.

**Architecture:** Drizzle ORM + `pg` driver connect to PGlite (dev) or PostgreSQL (prod) via `DATABASE_URL`. A `selectAds(query)` function tokenises the query and matches ads using PostgreSQL's `&&` array overlap operator via raw SQL. Click tracking goes through `/api/ads/click?id=<id>&q=<query>`, which looks up the ad in the DB and redirects to the stored URL — never a user-supplied URL.

**Tech Stack:** Drizzle ORM (`drizzle-orm/node-postgres`), `pg`, PGlite socket server (local dev), Next.js App Router API routes, Tailwind v4, Vitest (unit), Playwright (E2E).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/libs/Env.ts` | Modify | Add `DATABASE_URL` server env var |
| `src/libs/DB.ts` | Create | Drizzle singleton connected to pg pool |
| `src/models/Schema.ts` | Create | `ads` + `ad_clicks` table definitions |
| `migrations/` | Generate | Drizzle migration files (auto-generated) |
| `src/libs/ads.ts` | Create | `tokenize()` + `selectAds()` |
| `src/libs/ads.test.ts` | Create | Unit tests for tokenise + empty-guard |
| `src/components/AdCard.tsx` | Create | Rich ad card UI component |
| `src/app/api/ads/click/route.ts` | Create | Click tracking + DB-URL redirect |
| `src/app/api/ads/click/route.test.ts` | Create | Unit tests for click route |
| `src/app/[locale]/(marketing)/search/page.tsx` | Modify | Wire top + bottom ad slots |
| `playwright.config.ts` | Modify | Forward `DATABASE_URL` to webServer env |
| `tests/e2e/global-setup.ts` | Modify | Start PGlite, run migrations, seed test ad |
| `tests/e2e/global-teardown.ts` | Modify | Stop PGlite server |
| `tests/e2e/Ads.e2e.ts` | Create | E2E tests for ad display |
| `scripts/seed-ads.ts` | Create | Dev seed script |

---

## Task 1: Database Infrastructure

**Files:**
- Modify: `src/libs/Env.ts`
- Create: `src/libs/DB.ts`

- [ ] **Step 1: Add DATABASE_URL to Env.ts**

Replace the entire contents of `src/libs/Env.ts`:

```typescript
import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

export const Env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BRAVE_SEARCH_API_KEY: z.string().min(1),
    BRAVE_API_BASE_URL: z.url().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().optional(),
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
  },
  skipValidation: process.env.NODE_ENV === 'test',
});
```

- [ ] **Step 2: Create `src/libs/DB.ts`**

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/models/Schema';
import { Env } from './Env';

const globalWithDb = globalThis as typeof globalThis & {
  _dbPool?: Pool;
};

if (!globalWithDb._dbPool) {
  globalWithDb._dbPool = new Pool({ connectionString: Env.DATABASE_URL });
}

/** Shared Drizzle database instance. Single pool across Next.js hot-reloads. */
export const db = drizzle(globalWithDb._dbPool, { schema });
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run check:types`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/libs/Env.ts src/libs/DB.ts
git commit -m "feat: restore database infrastructure with DATABASE_URL"
```

---

## Task 2: Schema

**Files:**
- Create: `src/models/Schema.ts`

- [ ] **Step 1: Create schema file**

```typescript
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const ads = pgTable('ads', {
  id: serial('id').primaryKey(),
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

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run check:types`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/models/Schema.ts
git commit -m "feat: add ads and ad_clicks schema"
```

---

## Task 3: Migration

**Files:**
- Auto-generated: `migrations/` directory

> **Before running:** Make sure `.env` contains `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres` (it already does) and the PGlite dev server is running. Start it with: `npx pglite-server -m 100 --db=local.db` in a separate terminal from the `symbolic/` directory. Wait for it to print that it's listening.

- [ ] **Step 1: Generate migration file**

Run from `symbolic/` directory:
```bash
npm run db:generate
```
Expected: `migrations/` directory created with a `.sql` file containing `CREATE TABLE "ads"` and `CREATE TABLE "ad_clicks"` statements.

- [ ] **Step 2: Apply migration**

```bash
npm run db:migrate
```
Expected: "All migrations ran successfully" (or similar from drizzle-kit).

- [ ] **Step 3: Verify tables exist**

```bash
npx psql postgresql://postgres:postgres@127.0.0.1:5432/postgres -c "\dt"
```
Expected: `ads` and `ad_clicks` in the table list. (If `psql` isn't installed, skip this step — the migration output is sufficient.)

- [ ] **Step 4: Commit**

```bash
git add migrations/
git commit -m "feat: add migration for ads and ad_clicks tables"
```

---

## Task 4: selectAds Function

**Files:**
- Create: `src/libs/ads.ts`
- Create: `src/libs/ads.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/libs/ads.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

// Mock DB before importing the module under test
vi.mock('./DB', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from './DB';
import { selectAds, tokenize } from './ads';

describe('tokenize', () => {
  it('splits on whitespace', () => {
    expect(tokenize('running shoes')).toEqual(['running', 'shoes']);
  });

  it('splits on punctuation', () => {
    expect(tokenize('buy, shoes!')).toEqual(['buy', 'shoes']);
  });

  it('lowercases all tokens', () => {
    expect(tokenize('Running SHOES')).toEqual(['running', 'shoes']);
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(tokenize('   ')).toEqual([]);
  });

  it('filters out empty strings from splits', () => {
    expect(tokenize('a,,b')).toEqual(['a', 'b']);
  });
});

describe('selectAds', () => {
  it('returns empty array without querying db when query tokenises to nothing', async () => {
    const result = await selectAds('');
    expect(result).toEqual([]);
    expect(vi.mocked(db.select)).not.toHaveBeenCalled();
  });

  it('returns empty array without querying db for punctuation-only query', async () => {
    const result = await selectAds('...');
    expect(result).toEqual([]);
    expect(vi.mocked(db.select)).not.toHaveBeenCalled();
  });

  it('queries db when tokens are present', async () => {
    const mockRows = [
      {
        id: 1,
        title: 'Buy Shoes',
        url: 'https://shoes.example.com',
        displayUrl: 'shoes.example.com',
        description: 'Great shoes',
        ctaText: 'Shop Now →',
        keywords: ['running', 'shoes'],
        bidAmount: 100,
        active: true,
        advertiserName: 'Shoes Co',
        createdAt: new Date(),
      },
    ];
    const mockLimit = vi.fn().mockResolvedValue(mockRows);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom } as ReturnType<
      typeof db.select
    >);

    const result = await selectAds('running shoes');
    expect(db.select).toHaveBeenCalled();
    expect(result).toEqual(mockRows);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `npm run test -- ads.test`
Expected: FAIL — `selectAds` and `tokenize` not found

- [ ] **Step 3: Implement `src/libs/ads.ts`**

```typescript
import { and, desc, eq, sql } from 'drizzle-orm';
import { ads } from '@/models/Schema';
import { db } from './DB';

export type Ad = typeof ads.$inferSelect;

/**
 * Lowercases and splits a search query into keyword tokens.
 * Splits on whitespace and common punctuation.
 */
export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,.:;!?'"()\[\]{}]+/)
    .filter(Boolean);
}

/**
 * Selects up to 2 active ads whose keywords overlap with the search query.
 * Returns highest-bid ads first.
 * Returns an empty array when the query produces no tokens.
 */
export async function selectAds(query: string): Promise<Ad[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  // The && operator checks array overlap. Drizzle's query builder does not
  // support &&, so we use a raw SQL fragment. The ::text[] cast is required
  // for PGlite to resolve the operator overload correctly.
  return db
    .select()
    .from(ads)
    .where(
      and(
        eq(ads.active, true),
        sql`${ads.keywords} && ${tokens}::text[]`,
      ),
    )
    .orderBy(desc(ads.bidAmount))
    .limit(2);
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm run test -- ads.test`
Expected: 9 tests pass

- [ ] **Step 5: Typecheck**

Run: `npm run check:types`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/libs/ads.ts src/libs/ads.test.ts
git commit -m "feat: add selectAds function with keyword tokeniser"
```

---

## Task 5: AdCard Component

**Files:**
- Create: `src/components/AdCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
import type { Ad } from '@/libs/ads';

type AdCardProps = {
  ad: Ad;
  query: string;
};

/**
 * Rich ad card displayed in sponsored slots on the search results page.
 * Title and CTA both link through the server-side click route — the
 * destination URL is never exposed directly to the browser.
 */
export function AdCard(props: AdCardProps) {
  const clickUrl = `/api/ads/click?id=${String(props.ad.id)}&q=${encodeURIComponent(props.query)}`;

  return (
    <div className="mb-6 rounded-md border border-symbolic-border border-l-[3px] border-l-symbolic-accent bg-symbolic-surface p-4">
      <div className="mb-2 text-xs font-semibold tracking-widest text-symbolic-accent">
        SPONSORED
      </div>
      <div className="mb-1 text-sm text-symbolic-url">{props.ad.displayUrl}</div>
      <a
        href={clickUrl}
        className="mb-1.5 block text-lg font-medium text-symbolic-link hover:underline"
      >
        {props.ad.title}
      </a>
      <p className="mb-3 text-sm leading-relaxed text-symbolic-muted">
        {props.ad.description}
      </p>
      <a
        href={clickUrl}
        className="rounded bg-symbolic-accent px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
      >
        {props.ad.ctaText}
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run check:types`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/AdCard.tsx
git commit -m "feat: add AdCard component for sponsored results"
```

---

## Task 6: Click Tracking Route

**Files:**
- Create: `src/app/api/ads/click/route.ts`
- Create: `src/app/api/ads/click/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/ads/click/route.test.ts`:

```typescript
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/libs/DB', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));
vi.mock('@/models/Schema', () => ({
  ads: { id: 'id', active: 'active' },
  adClicks: {},
}));

import { db } from '@/libs/DB';
import { GET } from './route';

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/ads/click');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

function mockAdSelect(rows: unknown[]) {
  const mockLimit = vi.fn().mockResolvedValue(rows);
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  vi.mocked(db.select).mockReturnValue({ from: mockFrom } as ReturnType<
    typeof db.select
  >);
}

function mockInsert() {
  const mockValues = vi.fn().mockResolvedValue(undefined);
  vi.mocked(db.insert).mockReturnValue({ values: mockValues } as ReturnType<
    typeof db.insert
  >);
}

describe('GET /api/ads/click', () => {
  it('returns 400 when id is missing', async () => {
    const response = await GET(makeRequest({ q: 'shoes' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when id is not a positive integer', async () => {
    const response = await GET(makeRequest({ id: '0', q: 'shoes' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when id is not a number', async () => {
    const response = await GET(makeRequest({ id: 'abc', q: 'shoes' }));
    expect(response.status).toBe(400);
  });

  it('returns 404 when ad is not found', async () => {
    mockAdSelect([]);
    const response = await GET(makeRequest({ id: '999', q: 'shoes' }));
    expect(response.status).toBe(404);
  });

  it('returns 404 when ad is inactive', async () => {
    mockAdSelect([{ id: 1, url: 'https://example.com', active: false }]);
    const response = await GET(makeRequest({ id: '1', q: 'shoes' }));
    expect(response.status).toBe(404);
  });

  it('redirects to the DB-stored URL when ad is found and active', async () => {
    mockAdSelect([{ id: 1, url: 'https://legit.example.com', active: true }]);
    mockInsert();
    const response = await GET(makeRequest({ id: '1', q: 'shoes' }));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://legit.example.com');
  });

  it('ignores any url param in the query string — no open redirect', async () => {
    mockAdSelect([{ id: 1, url: 'https://legit.example.com', active: true }]);
    mockInsert();
    const response = await GET(
      makeRequest({ id: '1', q: 'shoes', url: 'https://evil.com' }),
    );
    expect(response.headers.get('location')).toBe('https://legit.example.com');
  });

  it('records a click row before redirecting', async () => {
    mockAdSelect([{ id: 1, url: 'https://legit.example.com', active: true }]);
    const mockValues = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as ReturnType<
      typeof db.insert
    >);

    await GET(makeRequest({ id: '1', q: 'running shoes' }));

    expect(db.insert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ adId: 1, query: 'running shoes' }),
    );
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `npm run test -- route.test`
Expected: FAIL — route not found

- [ ] **Step 3: Implement the route**

Create `src/app/api/ads/click/route.ts`:

```typescript
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { adClicks, ads } from '@/models/Schema';

export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get('id');
  const query = request.nextUrl.searchParams.get('q') ?? '';

  const id = Number(idParam);
  if (!idParam || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const [ad] = await db
    .select()
    .from(ads)
    .where(eq(ads.id, id))
    .limit(1);

  if (!ad || !ad.active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.insert(adClicks).values({ adId: id, query });

  // Always redirect to the DB-stored URL — never to any URL from the request.
  return NextResponse.redirect(ad.url, { status: 302 });
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm run test -- route.test`
Expected: 7 tests pass

- [ ] **Step 5: Typecheck**

Run: `npm run check:types`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/ads/click/route.ts src/app/api/ads/click/route.test.ts
git commit -m "feat: add click tracking route with open-redirect protection"
```

---

## Task 7: Wire Ad Slots into Search Page

**Files:**
- Modify: `src/app/[locale]/(marketing)/search/page.tsx`

- [ ] **Step 1: Update the search page**

Replace the entire file with:

```typescript
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdCard } from '@/components/AdCard';
import { Pagination } from '@/components/Pagination';
import { ResultsList } from '@/components/ResultsList';
import { SearchLayout } from '@/components/SearchLayout';
import { selectAds } from '@/libs/ads';
import { searchWeb } from '@/libs/brave';

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; offset?: string; lucky?: string }>;
};

export async function generateMetadata(
  props: SearchPageProps
): Promise<Metadata> {
  const { q } = await props.searchParams;
  return { title: q ? `${q} — Symbolic` : 'Search — Symbolic' };
}

export default async function SearchPage(props: SearchPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const { q, offset: offsetStr, lucky } = await props.searchParams;
  const query = q?.trim();

  if (!query) {
    redirect('/');
  }

  const offset = Number(offsetStr ?? 0);
  const cookieStore = await cookies();
  const rawSafesearch = cookieStore.get('symbolic_safesearch')?.value;
  const safesearch: 'off' | 'moderate' | 'strict' =
    rawSafesearch === 'off' || rawSafesearch === 'strict'
      ? rawSafesearch
      : 'moderate';

  let results: Awaited<ReturnType<typeof searchWeb>> | null = null;
  let error: string | null = null;
  let adList: Awaited<ReturnType<typeof selectAds>> = [];

  try {
    [results, adList] = await Promise.all([
      searchWeb({ query, offset, safesearch }),
      selectAds(query),
    ]);
  } catch {
    error = 'Something went wrong. Please try again.';
  }

  if (lucky === '1' && results?.results[0]) {
    redirect(results.results[0].url);
  }

  const topAd = adList[0];
  const bottomAd = adList[1];

  return (
    <SearchLayout query={query}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        {error && <p className="py-8 text-red-400">{error}</p>}

        {results && results.results.length === 0 && (
          <div className="py-8">
            <p className="text-symbolic-text">
              No results found for <strong>&ldquo;{query}&rdquo;</strong>
            </p>
            <p className="mt-2 text-sm text-symbolic-muted">
              Try different keywords or check your spelling.
            </p>
          </div>
        )}

        {results && results.results.length > 0 && (
          <>
            {topAd && <AdCard ad={topAd} query={query} />}
            <ResultsList results={results.results} />
            <Pagination
              query={query}
              offset={offset}
              count={results.results.length}
            />
            {bottomAd && <AdCard ad={bottomAd} query={query} />}
          </>
        )}
      </main>
    </SearchLayout>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run check:types`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/\(marketing\)/search/page.tsx
git commit -m "feat: wire ad slots into search results page"
```

---

## Task 8: E2E Test Infrastructure

**Files:**
- Modify: `playwright.config.ts`
- Modify: `tests/e2e/global-setup.ts`
- Modify: `tests/e2e/global-teardown.ts`

The E2E tests need a real database. We'll start PGlite on port 5433 (separate from the dev server's port 5432) inside `global-setup`, run migrations against it, and seed one test ad. The Next.js dev server will connect to it via `DATABASE_URL`.

- [ ] **Step 1: Add DATABASE_URL to playwright.config.ts webServer env**

In `playwright.config.ts`, add `DATABASE_URL` to the `webServer.env` block:

```typescript
    env: {
      NEXT_PUBLIC_SENTRY_DISABLED: 'true',
      NEXT_PUBLIC_APP_URL: baseURL,
      PORT,
      BRAVE_SEARCH_API_KEY: 'test-key',
      BRAVE_API_BASE_URL: 'http://localhost:3099',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5433/postgres',
    },
```

(Port 5433 — reserved for the test PGlite instance started by global-setup.)

- [ ] **Step 2: Update `tests/e2e/global-setup.ts`**

Replace the file with:

```typescript
import net from 'node:net';
import { once } from 'node:events';
import { execSync, spawn } from 'node:child_process';
import type { FullConfig } from '@playwright/test';
import { Pool } from 'pg';
import { createMockBraveServer } from './mock-brave-server';

const MOCK_PORT = 3099;
const DB_PORT = 5433;
const TEST_DB_URL = `postgresql://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`;

/** Poll until a TCP port accepts connections, or throw after timeout. */
async function waitForPort(port: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await new Promise<boolean>((resolve) => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
    });
    if (ready) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Port ${port} not ready after ${timeoutMs}ms`);
}

async function globalSetup(_config: FullConfig) {
  // ── Mock Brave search server ──────────────────────────────────────────────
  const braveServer = createMockBraveServer();
  braveServer.listen(MOCK_PORT);
  await once(braveServer, 'listening');
  (globalThis as Record<string, unknown>)['__mockBraveServer__'] = braveServer;

  // ── PGlite server for tests ───────────────────────────────────────────────
  // Starts an in-memory PGlite instance on DB_PORT (5433) so it doesn't
  // conflict with the local dev server on 5432.
  const pgliteServerBin =
    process.platform === 'win32'
      ? 'node_modules\\.bin\\pglite-server.cmd'
      : 'node_modules/.bin/pglite-server';

  const pgliteServer = spawn(pgliteServerBin, ['-m', '10', '--port', String(DB_PORT)], {
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
  (globalThis as Record<string, unknown>)['__pgliteServer__'] = pgliteServer;

  pgliteServer.stderr?.on('data', (d: Buffer) =>
    process.stderr.write(`[pglite] ${d.toString()}`),
  );

  await waitForPort(DB_PORT);

  // ── Migrations ────────────────────────────────────────────────────────────
  execSync('npx drizzle-kit migrate', {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit',
  });

  // ── Seed one test ad ──────────────────────────────────────────────────────
  const pool = new Pool({ connectionString: TEST_DB_URL });
  await pool.query(
    `INSERT INTO ads
       (advertiser_name, title, url, display_url, description, cta_text, keywords, bid_amount, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT DO NOTHING`,
    [
      'Test Shoes Co',
      'Buy Running Shoes — Free Shipping',
      'https://shoes.test.example.com',
      'shoes.test.example.com/sale',
      'Top running gear at unbeatable prices.',
      'Shop Now →',
      ['running', 'shoes'],
      100,
      true,
    ],
  );
  await pool.end();
}

export default globalSetup;
```

> **Note on `--port` flag:** If PGlite-socket's CLI doesn't support `--port`, check `npx pglite-server --help` and adjust to the correct flag name (may be `--socket-port`, `PORT` env var, or similar). The TCP connection string format remains `postgresql://postgres:postgres@127.0.0.1:<PORT>/postgres`.

- [ ] **Step 3: Update `tests/e2e/global-teardown.ts`**

```typescript
import type { FullConfig } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import type { Server } from 'node:http';

async function globalTeardown(_config: FullConfig) {
  const g = globalThis as Record<string, unknown>;

  const braveServer = g['__mockBraveServer__'] as Server | undefined;
  braveServer?.close();

  const pgliteServer = g['__pgliteServer__'] as ChildProcess | undefined;
  pgliteServer?.kill('SIGTERM');
}

export default globalTeardown;
```

- [ ] **Step 4: Typecheck**

Run: `npm run check:types`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/global-setup.ts tests/e2e/global-teardown.ts
git commit -m "test: wire PGlite test DB into Playwright global setup"
```

---

## Task 9: E2E Ad Tests

**Files:**
- Create: `tests/e2e/Ads.e2e.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { expect, test } from '@playwright/test';

// The test ad was seeded in global-setup with keywords ['running', 'shoes'].
// The mock Brave server (mock-brave-server.ts) returns results for any
// non-empty, non-error query — so the results page loads with real results.

test('sponsored ad appears above results when query matches ad keywords', async ({
  page,
}) => {
  await page.goto('/search?q=running+shoes');
  const ad = page.locator('[data-testid="ad-card"]').first();
  await expect(ad).toBeVisible();
  await expect(ad.getByText('SPONSORED')).toBeVisible();
  await expect(ad.getByText('Buy Running Shoes — Free Shipping')).toBeVisible();
  await expect(ad.getByText('Shop Now →')).toBeVisible();
});

test('ad click link points to click-tracking route, not raw destination', async ({
  page,
}) => {
  await page.goto('/search?q=running+shoes');
  const ctaLink = page
    .locator('[data-testid="ad-card"]')
    .first()
    .getByRole('link', { name: 'Shop Now →' });
  const href = await ctaLink.getAttribute('href');
  expect(href).toMatch(/^\/api\/ads\/click\?id=\d+&q=running\+shoes$/);
});

test('no ad when query does not match any ad keywords', async ({ page }) => {
  await page.goto('/search?q=hello+world');
  await expect(page.locator('[data-testid="ad-card"]')).toHaveCount(0);
});

test('no ad on empty results page', async ({ page }) => {
  await page.goto('/search?q=xyzzy12345');
  await expect(page.locator('[data-testid="ad-card"]')).toHaveCount(0);
});
```

- [ ] **Step 2: Add `data-testid` to AdCard component**

In `src/components/AdCard.tsx`, add `data-testid="ad-card"` to the outer div:

```typescript
  return (
    <div
      data-testid="ad-card"
      className="mb-6 rounded-md border border-symbolic-border border-l-[3px] border-l-symbolic-accent bg-symbolic-surface p-4"
    >
```

- [ ] **Step 3: Run E2E tests**

Run: `npm run test:e2e -- --grep "ad"`
Expected: 4 tests pass

If the `--port` flag for pglite-server doesn't work, check the output of `npx pglite-server --help` in the `symbolic/` directory and update `global-setup.ts` with the correct flag. Then re-run.

- [ ] **Step 4: Run full E2E suite to confirm no regressions**

Run: `npm run test:e2e`
Expected: all tests pass (existing 8 Search tests + 4 new Ads tests)

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/Ads.e2e.ts src/components/AdCard.tsx
git commit -m "test: add E2E tests for ad display"
```

---

## Task 10: Dev Seed Script

**Files:**
- Create: `scripts/seed-ads.ts`

- [ ] **Step 1: Create the seed script**

```typescript
// scripts/seed-ads.ts
//
// Seeds sample ads into the local development database.
// Requires DATABASE_URL to be set in the environment, e.g.:
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres npx tsx scripts/seed-ads.ts
//
// Make sure the PGlite dev server is running first:
//   npx pglite-server -m 100 --db=local.db
//
// To wipe and re-seed, delete local.db and restart the server.

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ads } from '../src/models/Schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

const seedAds = [
  {
    advertiserName: 'RunFast Store',
    title: 'Best Running Shoes 2025 — Up to 40% Off',
    url: 'https://runfast.example.com/sale',
    displayUrl: 'runfast.example.com/sale',
    description:
      'Shop 500+ styles from top brands. Free next-day delivery & free returns. Price match guaranteed.',
    ctaText: 'Shop Now →',
    keywords: ['running', 'shoes', 'sneakers', 'marathon', 'jogging'],
    bidAmount: 250,
    active: true,
  },
  {
    advertiserName: 'TechDeals',
    title: 'Latest Laptops at Unbeatable Prices',
    url: 'https://techdeals.example.com/laptops',
    displayUrl: 'techdeals.example.com/laptops',
    description:
      'Browse 200+ laptops with same-day dispatch. Student discounts available.',
    ctaText: 'View Deals →',
    keywords: ['laptop', 'computer', 'tech', 'macbook', 'notebook'],
    bidAmount: 300,
    active: true,
  },
  {
    advertiserName: 'FlightFinder',
    title: 'Cheap Flights — Compare & Save',
    url: 'https://flightfinder.example.com',
    displayUrl: 'flightfinder.example.com',
    description:
      'Compare millions of flights. No booking fees. Best price guarantee.',
    ctaText: 'Search Flights →',
    keywords: ['flights', 'travel', 'airline', 'holiday', 'vacation'],
    bidAmount: 200,
    active: true,
  },
];

async function seed() {
  console.log('Seeding ads...');
  for (const ad of seedAds) {
    await db.insert(ads).values(ad).onConflictDoNothing();
    console.log(`  ✓ ${ad.advertiserName}`);
  }
  console.log('Done.');
  await pool.end();
}

seed().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add to knip.config.ts to suppress unused-file warning**

In `knip.config.ts`, add `'scripts/seed-ads.ts'` to the `ignore` array:

```typescript
  ignore: [
    // ... existing entries ...
    'scripts/seed-ads.ts',
  ],
```

- [ ] **Step 3: Verify the script typechecks**

Run: `npm run check:types`
Expected: no errors

- [ ] **Step 4: Run lint and dependency check**

Run: `npm run lint && npm run check:deps`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-ads.ts knip.config.ts
git commit -m "chore: add dev seed script for ads"
```

---

## Final Verification

- [ ] **Run all unit tests**

Run: `npm run test`
Expected: all pass

- [ ] **Run full E2E suite**

Run: `npm run test:e2e`
Expected: all pass

- [ ] **Run lint + typecheck + deps**

Run: `npm run lint && npm run check:types && npm run check:deps`
Expected: all clean
