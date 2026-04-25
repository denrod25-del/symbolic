import { and, desc, eq, sql } from 'drizzle-orm';
import { ads } from '@/models/Schema';
import { db } from './DB';

export type Ad = typeof ads.$inferSelect;

/**
 * Lowercases and splits a search query into keyword tokens.
 * Splits on whitespace and common punctuation.
 *
 * @param query - The raw search query string.
 * @returns Array of lowercase token strings.
 */
export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,.:;!?'"()[\]{}]+/)
    .filter(Boolean);
}

/**
 * Selects up to 2 active ads whose keywords overlap with the search query.
 * Returns highest-bid ads first.
 * Returns an empty array when the query produces no tokens.
 *
 * @param query - The raw search query string.
 * @returns Promise resolving to matching ad rows.
 */
export async function selectAds(query: string): Promise<Ad[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return [];
  }

  // The && operator checks array overlap. Drizzle's query builder does not
  // support &&, so we use a raw SQL fragment. The ::text[] cast is required
  // for PGlite to resolve the operator overload correctly.
  return  db
    .select()
    .from(ads)
    .where(
      and(
        eq(ads.active, true),
        sql`${ads.keywords} && ARRAY[${sql.join(
          tokens.map((t) => sql`${t}`),
          sql`, `
        )}]::text[]`
      )
    )
    .orderBy(desc(ads.bidAmount))
    .limit(2);
}
