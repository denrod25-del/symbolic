import { desc, eq, sql } from 'drizzle-orm';
import { advertisers, billingTransactions } from '@/models/Schema';
import { db } from './DB';

type CreditTopUpInput = {
  advertiserId: number;
  amountCents: number;
  stripeSessionId: string;
};

type ChargeForClickInput = {
  advertiserId: number;
  amountCents: number;
  adId: number | null;
  description: string;
};

/**
 * Reads an advertiser's cached balance.
 * @param advertiserId - The advertiser's id.
 * @returns The balance in cents, or 0 if the advertiser does not exist.
 */
export async function getBalanceCents(advertiserId: number): Promise<number> {
  const [row] = await db
    .select({ balanceCents: advertisers.balanceCents })
    .from(advertisers)
    .where(eq(advertisers.id, advertiserId));

  return row?.balanceCents ?? 0;
}

/**
 * Lists an advertiser's ledger transactions, newest first.
 * @param advertiserId - The advertiser's id.
 * @param limit - Maximum number of rows to return.
 * @returns The matching ledger rows, ordered by creation time descending.
 */
export function listTransactions(advertiserId: number, limit: number) {
  return db
    .select()
    .from(billingTransactions)
    .where(eq(billingTransactions.advertiserId, advertiserId))
    .orderBy(desc(billingTransactions.createdAt), desc(billingTransactions.id))
    .limit(limit);
}

/**
 * Credits an advertiser's balance for a completed Stripe checkout, recording
 * a `topup` ledger row. Idempotent on `stripeSessionId`: Stripe retries
 * webhook deliveries, and a session already credited must not be credited
 * again.
 * @param input - The advertiser, amount, and Stripe session identifying the top-up.
 * @returns `'credited'` when the balance was updated, `'duplicate'` when the
 * session id was already recorded and nothing changed.
 * @throws When the advertiser does not exist.
 */
export async function creditTopUp(
  input: CreditTopUpInput
): Promise<'credited' | 'duplicate'> {
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: billingTransactions.id })
      .from(billingTransactions)
      .where(eq(billingTransactions.stripeSessionId, input.stripeSessionId));

    if (existing) {
      return 'duplicate';
    }

    const [updated] = await tx
      .update(advertisers)
      .set({
        balanceCents: sql`${advertisers.balanceCents} + ${input.amountCents}`,
      })
      .where(eq(advertisers.id, input.advertiserId))
      .returning({ balanceCents: advertisers.balanceCents });

    if (!updated) {
      throw new Error(`Advertiser ${input.advertiserId} does not exist`);
    }

    await tx.insert(billingTransactions).values({
      advertiserId: input.advertiserId,
      kind: 'topup',
      amountCents: input.amountCents,
      balanceAfterCents: updated.balanceCents,
      stripeSessionId: input.stripeSessionId,
      description: 'Top-up',
    });

    return 'credited';
  });

  return result;
}

/**
 * Charges an advertiser's balance for an ad click, recording a
 * `click_charge` ledger row with a negative amount.
 * @param input - The advertiser, charge amount, ad, and description.
 * @throws When the advertiser does not exist.
 */
export async function chargeForClick(
  input: ChargeForClickInput
): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(advertisers)
      .set({
        balanceCents: sql`${advertisers.balanceCents} - ${input.amountCents}`,
      })
      .where(eq(advertisers.id, input.advertiserId))
      .returning({ balanceCents: advertisers.balanceCents });

    if (!updated) {
      throw new Error(`Advertiser ${input.advertiserId} does not exist`);
    }

    await tx.insert(billingTransactions).values({
      advertiserId: input.advertiserId,
      kind: 'click_charge',
      amountCents: -input.amountCents,
      balanceAfterCents: updated.balanceCents,
      adId: input.adId,
      description: input.description,
    });
  });
}
