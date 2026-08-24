'use server';

import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { advertisers } from '@/models/Schema';
import { db } from './DB';
import { createTopUpLink } from './payments';

const MIN_TOPUP_CENTS = 1000;
const MAX_TOPUP_CENTS = 50_000;

export type TopUpError =
  | 'not_signed_in'
  | 'invalid_amount'
  | 'no_account'
  | 'checkout_failed';

/**
 * Starts a Stripe Checkout session to top up the signed-in advertiser's balance.
 * @param amountCents - The amount to add, in cents.
 * @returns The checkout URL to redirect to, or an error code.
 */
export async function createTopUpSession(
  amountCents: number
): Promise<{ url: string } | { error: TopUpError }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'not_signed_in' };
  }

  if (
    !Number.isInteger(amountCents) ||
    amountCents < MIN_TOPUP_CENTS ||
    amountCents > MAX_TOPUP_CENTS
  ) {
    return { error: 'invalid_amount' };
  }

  const [advertiser] = await db
    .select({ id: advertisers.id })
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, user.id))
    .limit(1);

  if (!advertiser) {
    return { error: 'no_account' };
  }

  const result = await createTopUpLink({
    advertiserId: advertiser.id,
    amountCents,
  });

  if (result.status === 'failed') {
    return { error: 'checkout_failed' };
  }

  return { url: result.url };
}
