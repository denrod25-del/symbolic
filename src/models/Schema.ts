import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// The generated migration file will reflect your schema changes.
// It automatically run the command `db-server:file`, which apply the migration before Next.js starts in development mode,
// Alternatively, if your database is running, you can run `npm run db:migrate` and there is no need to restart the server.

// Need a database for production? Check out https://get.neon.com/BMFYNtx
// Tested and compatible with Next.js Boilerplate

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
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
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
  status: text('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: text('reviewed_by'),
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

// CRM module: contacts and sales pipeline, scoped per Clerk user (tenant).

export const crmContacts = pgTable('crm_contacts', {
  id: serial('id').primaryKey(),
  ownerClerkUserId: text('owner_clerk_user_id').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const crmOpportunities = pgTable('crm_opportunities', {
  id: serial('id').primaryKey(),
  ownerClerkUserId: text('owner_clerk_user_id').notNull(),
  contactId: integer('contact_id').references(() => crmContacts.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  stage: text('stage').notNull().default('lead'),
  value: integer('value').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const crmMessages = pgTable('crm_messages', {
  id: serial('id').primaryKey(),
  ownerClerkUserId: text('owner_clerk_user_id').notNull(),
  contactId: integer('contact_id')
    .notNull()
    .references(() => crmContacts.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull(),
  direction: text('direction').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  status: text('status').notNull().default('queued'),
  providerId: text('provider_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const crmAppointments = pgTable('crm_appointments', {
  id: serial('id').primaryKey(),
  ownerClerkUserId: text('owner_clerk_user_id').notNull(),
  contactId: integer('contact_id').references(() => crmContacts.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  startAt: timestamp('start_at', { mode: 'date' }).notNull(),
  endAt: timestamp('end_at', { mode: 'date' }).notNull(),
  status: text('status').notNull().default('scheduled'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
