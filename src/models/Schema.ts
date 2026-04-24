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
