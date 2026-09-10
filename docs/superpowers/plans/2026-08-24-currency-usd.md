# Currency Migration to USD (Phase 5, Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display all ad-platform money in USD through one shared `formatUsd` helper, replacing the scattered `£{(x / 100).toFixed(2)}` expressions.

**Architecture:** Add `src/utils/Money.ts` with a single `formatUsd(cents)` function, then replace the five ad-platform display sites and two i18n strings that currently show `£`. No stored data changes — the integers stay identical, only the symbol and formatting change.

**Tech Stack:** TypeScript, `Intl.NumberFormat`, Vitest.

---

## Environment notes for the implementer

- `bun` is NOT installed. Use `./node_modules/.bin/tsc --noEmit`,
  `./node_modules/.bin/vitest run <file>`, `npx ultracite check --type-aware --type-check`.
- **The Bash tool's cwd resets between commands** — start every command with
  `cd /c/Users/skyea/claude/symbolic &&`.
- If `node_modules` is missing, run `cmd.exe /c "npm ci"` first (~2 min).
- Lint rules that bite: no `.then` chains, no nested ternaries, no unsafe casts
  without a narrow eslint-disable, `require-await`. The formatter (`ultracite`)
  reformats on commit via a pre-commit hook — let it.
- Line-ending (CRLF) warnings from git are noise; ignore them.

## IMPORTANT: what NOT to touch

`£` also appears in the **QuoteIQ CRM**, which is a separate product in this
repo. Leave these files completely alone:

- `src/app/[locale]/(portal)/crm/automations/WorkflowForm.tsx`
- `src/app/[locale]/(portal)/crm/invoices/InvoiceCostField.tsx`
- `src/app/[locale]/(portal)/crm/pipeline/PipelineBoard.tsx`
- the `unit_price` key in `src/locales/en.json` / `fr.json`

Only the ad platform migrates to USD.

## File map

| File | Action | Purpose |
|---|---|---|
| `src/utils/Money.ts` | Create | `formatUsd(cents)` helper |
| `src/utils/Money.test.ts` | Create | Unit tests for the helper |
| `src/app/[locale]/(portal)/advertise/ads/page.tsx` | Modify | Bid column |
| `src/app/[locale]/(admin)/admin/ads/page.tsx` | Modify | Bid column |
| `src/app/[locale]/(admin)/admin/queue/page.tsx` | Modify | Bid line |
| `src/app/[locale]/(admin)/admin/dashboard/page.tsx` | Modify | Revenue stat |
| `src/components/AdWizard.tsx` | Modify | Bid input prefix |
| `src/locales/en.json`, `fr.json` | Modify | `budget_placeholder`, `bid_minimum` |
| `src/libs/adActions.test.ts` | Modify | Two stale `£` comments |

---

## Task 1: The `formatUsd` helper (TDD)

**Files:**
- Create: `src/utils/Money.ts`
- Create: `src/utils/Money.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/Money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatUsd } from './Money';

describe('formatUsd', () => {
  it('formats whole dollars', () => {
    expect(formatUsd(2500)).toBe('$25.00');
  });

  it('formats sub-dollar amounts', () => {
    expect(formatUsd(50)).toBe('$0.50');
  });

  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('formats negative amounts', () => {
    expect(formatUsd(-50)).toBe('-$0.50');
  });

  it('adds a thousands separator', () => {
    expect(formatUsd(123_456)).toBe('$1,234.56');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/vitest run src/utils/Money.test.ts`
Expected: FAIL — cannot find module `./Money`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/Money.ts`:

```ts
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/**
 * Formats an integer cent amount as a USD string.
 * @param cents - The amount in whole cents; may be negative.
 * @returns The formatted amount, e.g. `$25.00`.
 */
export function formatUsd(cents: number): string {
  return usdFormatter.format(cents / 100);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/vitest run src/utils/Money.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Type-check and lint**

Run: `cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/tsc --noEmit`
Expected: no output.

If the pre-commit knip check flags `src/utils/Money.ts` as an unused export
(its consumers arrive in Task 2), add `'src/utils/Money.ts'` to the `ignore`
array in `knip.config.ts` and remove it again at the end of Task 2.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/skyea/claude/symbolic && git add src/utils/Money.ts src/utils/Money.test.ts knip.config.ts && git commit -m "feat: add formatUsd money helper"
```

(Include `knip.config.ts` only if you changed it.)

---

## Task 2: Replace the five display sites

**Files:**
- Modify: `src/app/[locale]/(portal)/advertise/ads/page.tsx`
- Modify: `src/app/[locale]/(admin)/admin/ads/page.tsx`
- Modify: `src/app/[locale]/(admin)/admin/queue/page.tsx`
- Modify: `src/app/[locale]/(admin)/admin/dashboard/page.tsx`
- Modify: `src/components/AdWizard.tsx`

- [ ] **Step 1: Advertiser ads list**

In `src/app/[locale]/(portal)/advertise/ads/page.tsx`, add the import
`import { formatUsd } from '@/utils/Money';` alongside the existing imports,
then replace this line (currently around line 105):

```tsx
                <span>£{(ad.bidAmount / 100).toFixed(2)}</span>
```

with:

```tsx
                <span>{formatUsd(ad.bidAmount)}</span>
```

- [ ] **Step 2: Admin ads list**

In `src/app/[locale]/(admin)/admin/ads/page.tsx`, add
`import { formatUsd } from '@/utils/Money';`, then replace (around line 107):

```tsx
              <span>£{(ad.bidAmount / 100).toFixed(2)}</span>
```

with:

```tsx
              <span>{formatUsd(ad.bidAmount)}</span>
```

- [ ] **Step 3: Admin review queue**

In `src/app/[locale]/(admin)/admin/queue/page.tsx`, add
`import { formatUsd } from '@/utils/Money';`, then replace (around line 48):

```tsx
                    {t('bid_label')}: £{(ad.bidAmount / 100).toFixed(2)}
```

with:

```tsx
                    {t('bid_label')}: {formatUsd(ad.bidAmount)}
```

- [ ] **Step 4: Admin dashboard revenue stat**

In `src/app/[locale]/(admin)/admin/dashboard/page.tsx`, add
`import { formatUsd } from '@/utils/Money';`. There is currently a variable
computed as `const revenuePounds = (stats.revenuePenceLast30Days / 100).toFixed(2);`
— delete that line entirely, and replace the render line (around line 63):

```tsx
          <div className="mt-1 text-3xl font-bold">£{revenuePounds}</div>
```

with:

```tsx
          <div className="mt-1 text-3xl font-bold">
            {formatUsd(stats.revenuePenceLast30Days)}
          </div>
```

Note: leave the `revenuePenceLast30Days` field name in `src/libs/adminStats.ts`
alone. Renaming it is churn across the stats type for no behavioural gain; the
value is minor currency units either way.

- [ ] **Step 5: AdWizard bid input**

In `src/components/AdWizard.tsx`, replace the currency prefix (around line 266):

```tsx
              <span className="text-white/50">£</span>
```

with:

```tsx
              <span className="text-white/50">$</span>
```

This one is a bare symbol next to an input, not a formatted amount, so it does
not use `formatUsd`.

- [ ] **Step 6: Verify no ad-platform `£` remains**

Run:

```bash
cd /c/Users/skyea/claude/symbolic && grep -rn '£' src --include=*.tsx --include=*.ts | grep -v crm | grep -v locales
```

Expected output: only the two comment lines in `src/libs/adActions.test.ts`
(fixed in Task 3). No CRM files should appear because of the `grep -v crm`.

- [ ] **Step 7: Type-check, lint, and test**

```bash
cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

Expected: no type errors; all tests pass.

If you added `src/utils/Money.ts` to the knip ignore list in Task 1, remove that
entry now and confirm `npx knip` does not complain.

- [ ] **Step 8: Commit**

```bash
cd /c/Users/skyea/claude/symbolic && git add "src/app/\[locale\]" src/components/AdWizard.tsx knip.config.ts && git commit -m "refactor: display ad platform amounts in USD"
```

(Include `knip.config.ts` only if you changed it.)

---

## Task 3: i18n strings and stale test comments

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/fr.json`
- Modify: `src/libs/adActions.test.ts`

- [ ] **Step 1: English strings**

In `src/locales/en.json`:

- In the `AdvertiseDashboardPage` namespace, change
  `"budget_placeholder": "£0",` to `"budget_placeholder": "$0",`
- In the `AdWizard` namespace, change
  `"bid_minimum": "Minimum £0.10 per click",` to
  `"bid_minimum": "Minimum $0.10 per click",`

Do **not** touch `unit_price` — that belongs to the CRM.

- [ ] **Step 2: French strings**

In `src/locales/fr.json`:

- `"budget_placeholder": "£0",` becomes `"budget_placeholder": "0 $",`
- `"bid_minimum": "Minimum £0.10 par clic",` becomes
  `"bid_minimum": "Minimum 0,10 $ par clic",`

French convention puts the currency symbol after the amount and uses a comma
decimal separator, which is why these differ in shape from the English values.

Again, leave `unit_price` alone.

- [ ] **Step 3: Fix the stale comments in the ad actions test**

In `src/libs/adActions.test.ts`, two comments still say pence:

```ts
      expect(rows[0]?.bidAmount).toBe(50); // £0.50 = 50 pence
```

becomes

```ts
      expect(rows[0]?.bidAmount).toBe(50); // $0.50 = 50 cents
```

and

```ts
    it('returns error for bid below minimum (£0.10 = 10 pence)', async () => {
```

becomes

```ts
    it('returns error for bid below minimum ($0.10 = 10 cents)', async () => {
```

These are comments and a test title only — no assertion values change.

- [ ] **Step 4: Verify i18n integrity**

```bash
cd /c/Users/skyea/claude/symbolic && npm run check:i18n
```

Expected: "No missing keys found!" and "No invalid translations found!". A
non-zero exit from the pre-existing "unused keys" report is fine.

- [ ] **Step 5: Confirm only CRM `£` remains**

```bash
cd /c/Users/skyea/claude/symbolic && grep -rn '£' src | grep -v crm
```

Expected: only the `unit_price` lines in `en.json` and `fr.json` (a CRM key that
lives in the shared locale files). Nothing else.

- [ ] **Step 6: Full suite**

```bash
cd /c/Users/skyea/claude/symbolic && ./node_modules/.bin/vitest run
```

Expected: all tests pass. Start the PGLite server first if DB tests cannot
connect: `npx pglite-server -m 100 --db=local.db` in the background, then
`npx dotenv -c -- drizzle-kit migrate`.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/skyea/claude/symbolic && git add src/locales/en.json src/locales/fr.json src/libs/adActions.test.ts && git commit -m "refactor: switch ad platform copy to USD"
```

---

## Done

The ad platform reads in USD everywhere, all amounts flow through one helper,
and the CRM's GBP pricing is untouched. Stored values are unchanged — `50` was
50 pence and is now 50 cents.
