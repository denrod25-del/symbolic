# Phase 1 spec — Quotes → Invoices → Payments

Build plan for the quote-to-cash loop on the existing `/crm` module. This is the
single highest-impact gap from `crm-competitive-research.md`: quoting is the
namesake feature of a QuoteIQ-style product, and invoicing/payments complete the
core revenue loop. Scoped to match existing CRM patterns (per-Clerk-user tenancy,
server actions, next-intl, Drizzle, money stored as integer minor units).

## Status

- **Quotes — built** (schema, actions, UI, i18n, tests).
- **Invoices — built** (convert from accepted quote, status lifecycle, UI).
- Payments — specced below, not yet built.

## Data model

Money is stored as **integer minor units** (pence), matching
`crmOpportunities.value`. Currency is GBP to match the existing dashboard.

### `crm_quotes` (built)
- `id`, `ownerClerkUserId` (tenant), `contactId` → `crm_contacts` (`set null`)
- `title`, `status` (`draft | sent | accepted | declined`)
- `lineItems` jsonb: `{ description, quantity, unitPrice }[]` (unitPrice in pence)
- `total` integer (denormalised, recomputed from line items on every write)
- `notes`, `createdAt`, `updatedAt`

Line items live in jsonb (like `crmWorkflows.triggerConfig`) rather than a child
table: a quote is always read and written as a whole, so a single row keeps the
forms and queries simple. `total` is denormalised so list/dashboard views never
join or recompute.

### `crm_invoices` (built)
- Mirrors `crm_quotes` plus: `quoteId` → `crm_quotes` (`set null`), `status`
  (`draft | sent | paid | void`), `dueAt`, `amountPaid`.
- Created by converting an **accepted** quote (copies title, contact, line
  items, total; due in 14 days). Marking an invoice `paid` settles `amountPaid`
  to the full total.

### Payments (next)
- Reuse the existing messaging layer to send a payment link via the inbox.
- Add a `payments` provider in `src/libs/` mirroring `messaging.ts`: simulated
  when no keys, Stripe when `STRIPE_*` keys are set (all env via `Env.ts`).
- A Stripe webhook marks the invoice `paid` and sets `amountPaid`.

## Server actions (`src/libs/quoteActions.ts`, built)
`createQuote`, `updateQuote`, `deleteQuote`, `setQuoteStatus` — all verify
ownership, validate with Zod, recompute `total`, and `revalidatePath` the quotes
and dashboard routes. Same shape as `crmActions.ts`.

Next: `convertQuoteToInvoice(quoteId)` (gated on `status === 'accepted'`),
`createInvoice/updateInvoice/setInvoiceStatus`, `createPaymentLink(invoiceId)`.

## UI
- `/crm/quotes` — list + create/edit form with dynamic line items and live
  subtotal; row actions for edit, delete, and status transitions.
- Nav link in `crm/layout.tsx`; quotes KPI + link on the dashboard.
- Next: `/crm/invoices`, a "Convert to invoice" action on accepted quotes, and a
  public quote-accept page (ties into the future online-booking work).

## Automation hooks (later)
The existing workflow engine (`src/libs/workflows.ts`) gets new triggers
(`quote_accepted`, `invoice_paid`) and actions (`create_invoice`,
`send_payment_link`) so reminders and follow-ups reuse the run-log we already have.

## Out of scope for Phase 1
Inventory, multi-currency, taxes beyond a flat line total, partial payments,
recurring invoices. Add once the core loop is validated.
