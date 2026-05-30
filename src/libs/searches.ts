import { desc, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { searches } from '@/models/Schema';

const RECENT_LIMIT = 12;

/**
 * Records a search query for the recent-searches feed. No-ops on failure so
 * search rendering is never blocked by a logging error.
 *
 * @param query Trimmed user query to record.
 */
export async function recordSearch(query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) {
    return;
  }
  try {
    await db.insert(searches).values({ query: trimmed });
  } catch {
    // Swallow — logging is best-effort.
  }
}

/**
 * Returns the most recent distinct queries, newest first.
 *
 * @param limit Maximum number of queries to return.
 * @returns Array of distinct query strings.
 */
export async function recentSearches(limit = RECENT_LIMIT): Promise<string[]> {
  try {
    const rows = await db
      .select({
        query: searches.query,
        latest: sql<Date>`max(${searches.createdAt})`.as('latest'),
      })
      .from(searches)
      .groupBy(searches.query)
      .orderBy(desc(sql`max(${searches.createdAt})`))
      .limit(limit);
    return rows.map((row) => row.query);
  } catch {
    return [];
  }
}
