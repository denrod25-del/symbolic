'use server';

import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { newsPreferences } from '@/models/Schema';
import { db } from './DB';
import { NEWS_SOURCES } from './news';

/**
 * Returns the signed-in user's hidden news sources.
 * @returns Hidden source keys; empty for anonymous users.
 */
export async function getHiddenSources(): Promise<string[]> {
  const user = await currentUser();
  if (!user) {
    return [];
  }
  const [row] = await db
    .select()
    .from(newsPreferences)
    .where(eq(newsPreferences.clerkUserId, user.id))
    .limit(1);
  return row?.hiddenSources ?? [];
}

/**
 * Replaces the signed-in user's hidden news sources.
 * @param sources - Source keys to hide.
 * @returns An error object when refused, otherwise undefined.
 */
export async function setHiddenSources(
  sources: string[]
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not signed in' };
  }

  const valid = Object.keys(NEWS_SOURCES);
  if (sources.some((s) => !valid.includes(s))) {
    return { error: 'Unknown source' };
  }

  await db
    .insert(newsPreferences)
    .values({ clerkUserId: user.id, hiddenSources: sources })
    .onConflictDoUpdate({
      target: newsPreferences.clerkUserId,
      set: { hiddenSources: sources },
    });

  try {
    revalidatePath('/[locale]/discover', 'page');
  } catch {
    // no-op outside Next.js runtime
  }

  return undefined;
}
