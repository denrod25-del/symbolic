import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ads } from '../../src/models/Schema';

const TEST_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

let pool: Pool | undefined;

export function getTestDb() {
  pool ??= new Pool({ connectionString: TEST_DB_URL });
  return drizzle(pool, { schema: { ads } });
}

export async function seedTestAd() {
  const db = getTestDb();
  await db.insert(ads).values({
    advertiserName: 'Test Advertiser',
    title: 'Best Running Shoes 2025 — Up to 40% Off',
    url: 'https://runningshoes.example.com',
    displayUrl: 'runningshoes.example.com/sale',
    description: 'Shop 500+ styles from top brands. Free next-day delivery.',
    ctaText: 'Shop Now →',
    keywords: ['running', 'shoes', 'sport'],
    bidAmount: 100,
    active: true,
  });
}

export async function cleanTestAds() {
  const db = getTestDb();
  await db.delete(ads);
}

export async function closeTestDb() {
  await pool?.end();
  pool = undefined;
}
