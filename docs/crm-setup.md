# CRM platform setup

This guide covers running and configuring the CRM modules: contacts and sales
pipeline, calendar and booking, the messaging inbox, and workflow automation.

## What's included

| Area | Route | Notes |
| --- | --- | --- |
| Dashboard | `/crm/dashboard` | Contacts, open opportunities, pipeline value, upcoming bookings |
| Contacts | `/crm/contacts` | Create, edit, and delete contacts |
| Pipeline | `/crm/pipeline` | Five-stage kanban (Lead → Contacted → Qualified → Won / Lost) |
| Quotes | `/crm/quotes` | Create line-item estimates and move them draft → sent → accepted / declined |
| Invoices | `/crm/invoices` | Convert accepted quotes to invoices and track draft → sent → paid / void |
| Calendar | `/crm/calendar` | Book, reschedule, complete, and cancel appointments |
| Booking | `/crm/booking` | Share a public self-service link that books into the calendar |
| Inbox | `/crm/inbox` | Per-contact SMS and email conversations |
| Automations | `/crm/automations` | No-code trigger → action rules with a run log |

All data is scoped per signed-in user, so each account only sees its own
records.

## Prerequisites

- Node.js (project ships with PGlite, so no Docker is required for local dev)
- A [Clerk](https://clerk.com) application for authentication
- A PostgreSQL database for production (e.g. [Neon](https://get.neon.com/BMFYNtx))

## Environment variables

All variables are validated in `src/libs/Env.ts`; never read `process.env`
directly. Copy the example file and fill it in:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string (defaults to local PGlite) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk frontend key |
| `CLERK_SECRET_KEY` | Yes | Clerk backend key |
| `RESEND_API_KEY` | No | Enables real email sending |
| `RESEND_FROM_EMAIL` | No | Verified sender address for Resend |
| `TWILIO_ACCOUNT_SID` | No | Enables real SMS sending |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_FROM_NUMBER` | No | Twilio sender number in E.164 format |
| `STRIPE_SECRET_KEY` | No | Enables real Stripe Checkout payment links |
| `ANTHROPIC_API_KEY` | No | Enables the AI estimator on quotes and inbox reply drafting (Claude) |

## Running locally

```bash
npm install
npm run dev
```

`npm run dev` starts a local PGlite database, applies migrations, and runs
Next.js. Sign in, then open `/crm/dashboard`.

To apply schema changes after editing `src/models/Schema.ts`:

```bash
npm run db:generate   # create a migration from the schema
npm run db:migrate    # apply pending migrations
```

## Messaging providers

The inbox and the automation `send_message` action route through a provider
layer in `src/libs/messaging.ts`:

- **No keys set** — messages are recorded with a `sent` status but not actually
  delivered (simulated mode). This is the default and is ideal for development.
- **Resend keys set** — email messages are delivered via the Resend API.
- **Twilio keys set** — SMS messages are delivered via the Twilio API.

Provider selection happens per channel, so you can enable email and SMS
independently. Delivery or network errors are recorded as a `failed` status and
never crash the request.

## Workflow automation

Automations run when a CRM event fires. Each rule pairs a trigger with an
action and is logged on every run.

**Triggers**

- `contact_created` — a new contact is added
- `opportunity_stage_changed` — an opportunity moves stage (optionally filtered
  to one target stage)
- `appointment_booked` — a new appointment is scheduled
- `invoice_paid` — an invoice is marked paid

**Actions**

- `send_message` — send an SMS or email to the event's contact through the
  provider layer
- `create_opportunity` — open a new pipeline opportunity
- `request_review` — send the contact a review request with your review link

Example: *"When a contact is created, send a welcome SMS."* Create it in
`/crm/automations`, then add a contact and watch the run appear in the activity
feed. With no Twilio keys configured the message is simulated; add the keys to
deliver it for real.

## Production checklist

1. Provision a PostgreSQL database and set `DATABASE_URL`.
2. Set the Clerk keys for your production instance.
3. Run `npm run db:migrate` against the production database.
4. (Optional) Add Resend and/or Twilio keys to enable real messaging.
5. Build and start: `npm run build` then `npm run start`.
