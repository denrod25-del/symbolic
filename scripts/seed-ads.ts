// Requires DATABASE_URL to be set in the environment.
// Usage: DATABASE_URL=postgresql://... npx tsx scripts/seed-ads.ts
//
// This script inserts sample ads for local development.
// Run it once after starting the local PGlite server (npm run dev).

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ads } from '../src/models/Schema';

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('Error: DATABASE_URL is not set.');
  console.error(
    'Usage: DATABASE_URL=postgresql://... npx tsx scripts/seed-ads.ts'
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const db = drizzle(pool, { schema: { ads } });

const sampleAds = [
  {
    advertiserName: 'RunShoes Co',
    title: 'Best Running Shoes 2025 — Up to 40% Off',
    url: 'https://runningshoes.example.com/sale',
    displayUrl: 'runningshoes.example.com/sale',
    description:
      'Shop 500+ styles from top brands. Free next-day delivery & free returns. Price match guaranteed.',
    ctaText: 'Shop Now →',
    keywords: ['running', 'shoes', 'trainers', 'sport'],
    bidAmount: 150,
    active: true,
  },
  {
    advertiserName: 'TechGadgets',
    title: 'Latest Tech Gadgets — Free Shipping on Orders Over $50',
    url: 'https://techgadgets.example.com',
    displayUrl: 'techgadgets.example.com',
    description:
      'Browse thousands of tech gadgets, laptops, and accessories. Same-day dispatch available.',
    ctaText: 'Browse Now →',
    keywords: ['tech', 'gadgets', 'laptop', 'computer', 'electronics'],
    bidAmount: 200,
    active: true,
  },
  {
    advertiserName: 'BookWorld',
    title: 'BookWorld — Millions of Titles, Delivered Next Day',
    url: 'https://bookworld.example.com',
    displayUrl: 'bookworld.example.com',
    description:
      'Discover your next great read. New releases, bestsellers, and rare finds. Free returns.',
    ctaText: 'Find Your Book →',
    keywords: ['books', 'reading', 'novel', 'fiction', 'nonfiction'],
    bidAmount: 80,
    active: true,
  },
];

await db.insert(ads).values(sampleAds);
console.log(`Seeded ${sampleAds.length} ads.`);
await pool.end();
