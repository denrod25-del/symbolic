'use server';

import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { advertisers } from '@/models/Schema';
import { db } from './DB';
import { createTopUpLink } from './payments';

const MIN_TOPUP_CENTS = 1000;
const MAX_TOPUP_CENTS = 50_000;

/**
 * Starts a Stripe Checkout session to top up the signed-in advertiser's balance.
 * @param amountCents - The amount to add, in cents.
 * @returns The checkout URL to redirect to, or an error message.
 */
export async function createTopUpSession(
  amountCents: number
): Promise<{ url: string } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not signed in' };
  }

  if (
    !Number.isInteger(amountCents) ||
    amountCents < MIN_TOPUP_CENTS ||
    amountCents > MAX_TOPUP_CENTS
  ) {
    return { error: 'Enter an amount between $10 and $500' };
  }

  const [advertiser] = await db
    .select({ id: advertisers.id })
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, user.id))
    .limit(1);

  if (!advertiser) {
    return { error: 'Advertiser account not found' };
  }

  const result = await createTopUpLink({
    advertiserId: advertiser.id,
    amountCents,
  });

  if (result.status === 'failed') {
    return { error: "Couldn't start checkout" };
  }

  return { url: result.url };
}
