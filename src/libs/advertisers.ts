import { advertisers } from '@/models/Schema';
import { db } from './DB';

/**
 * Upserts an advertisers row for the given Clerk user.
 * Safe to call multiple times — creates on first call, no-ops thereafter.
 * @param clerkUserId - The Clerk user ID to associate with the advertiser.
 * @param email - The advertiser's email address.
 * @param name - The advertiser's display name.
 */
export async function ensureAdvertiser(
  clerkUserId: string,
  email: string,
  name: string
) {
  await db
    .insert(advertisers)
    .values({ clerkUserId, email, name })
    .onConflictDoNothing({ target: advertisers.clerkUserId });
}
