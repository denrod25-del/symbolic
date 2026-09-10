import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { advertisers, billingTransactions } from '@/models/Schema';
import {
  chargeForClick,
  creditTopUp,
  getBalanceCents,
  listTransactions,
} from './billing';
import { db } from './DB';

describe('billing', () => {
  let advertiserId: number;

  beforeEach(async () => {
    const [row] = await db
      .insert(advertisers)
      .values({
        clerkUserId: `billing_test_${crypto.randomUUID()}`,
        email: 'billing@example.com',
        name: 'Billing Test',
      })
      .returning();
    advertiserId = row!.id;
  });

  afterEach(async () => {
    await db
      .delete(billingTransactions)
      .where(eq(billingTransactions.advertiserId, advertiserId));
    await db.delete(advertisers).where(eq(advertisers.id, advertiserId));
  });

  describe('creditTopUp', () => {
    it('increases the balance and writes a ledger row', async () => {
      await creditTopUp({
        advertiserId,
        amountCents: 2500,
        stripeSessionId: `cs_test_${crypto.randomUUID()}`,
      });

      expect(await getBalanceCents(advertiserId)).toBe(2500);

      const rows = await listTransactions(advertiserId, 10);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.kind).toBe('topup');
      expect(rows[0]?.amountCents).toBe(2500);
      expect(rows[0]?.balanceAfterCents).toBe(2500);
    });

    it('accumulates across multiple top-ups', async () => {
      await creditTopUp({
        advertiserId,
        amountCents: 2500,
        stripeSessionId: `cs_a_${crypto.randomUUID()}`,
      });
      await creditTopUp({
        advertiserId,
        amountCents: 1000,
        stripeSessionId: `cs_b_${crypto.randomUUID()}`,
      });

      expect(await getBalanceCents(advertiserId)).toBe(3500);
    });

    it('ignores a duplicate stripe session id', async () => {
      const sessionId = `cs_dup_${crypto.randomUUID()}`;

      const first = await creditTopUp({
        advertiserId,
        amountCents: 2500,
        stripeSessionId: sessionId,
      });
      const second = await creditTopUp({
        advertiserId,
        amountCents: 2500,
        stripeSessionId: sessionId,
      });

      expect(first).toBe('credited');
      expect(second).toBe('duplicate');
      expect(await getBalanceCents(advertiserId)).toBe(2500);
      expect(await listTransactions(advertiserId, 10)).toHaveLength(1);
    });
  });

  describe('chargeForClick', () => {
    it('decreases the balance and records a negative amount', async () => {
      await creditTopUp({
        advertiserId,
        amountCents: 1000,
        stripeSessionId: `cs_c_${crypto.randomUUID()}`,
      });

      await chargeForClick({
        advertiserId,
        amountCents: 50,
        adId: null,
        description: 'Click on Test ad',
      });

      expect(await getBalanceCents(advertiserId)).toBe(950);

      const rows = await listTransactions(advertiserId, 10);
      expect(rows[0]?.kind).toBe('click_charge');
      expect(rows[0]?.amountCents).toBe(-50);
      expect(rows[0]?.balanceAfterCents).toBe(950);
    });
  });

  it('keeps the cached balance equal to the ledger sum', async () => {
    await creditTopUp({
      advertiserId,
      amountCents: 2500,
      stripeSessionId: `cs_d_${crypto.randomUUID()}`,
    });
    await chargeForClick({
      advertiserId,
      amountCents: 50,
      adId: null,
      description: 'Click',
    });
    await chargeForClick({
      advertiserId,
      amountCents: 75,
      adId: null,
      description: 'Click',
    });

    const [summed] = await db
      .select({
        total:
          sql<number>`coalesce(sum(${billingTransactions.amountCents}), 0)`.mapWith(
            Number
          ),
      })
      .from(billingTransactions)
      .where(eq(billingTransactions.advertiserId, advertiserId));

    expect(await getBalanceCents(advertiserId)).toBe(summed?.total);
    expect(summed?.total).toBe(2375);
  });
});
