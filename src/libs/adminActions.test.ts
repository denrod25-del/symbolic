import { eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ads, advertisers } from '@/models/Schema';
import { approveAd, rejectAd, suspendAd, unsuspendAd } from './adminActions';
import { db } from './DB';

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
}));

const { currentUser } = await import('@clerk/nextjs/server');
const mockCurrentUser = vi.mocked(currentUser);

function asAdmin() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  mockCurrentUser.mockResolvedValue({
    id: 'admin_clerk_id',
    primaryEmailAddress: { emailAddress: 'admin@symbolic.test' },
  } as never);
}

function asNonAdmin() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  mockCurrentUser.mockResolvedValue({
    id: 'user_clerk_id',
    primaryEmailAddress: { emailAddress: 'nobody@example.com' },
  } as never);
}

describe('adminActions', () => {
  let advertiserId: number;
  const insertedAdIds: number[] = [];

  beforeEach(async () => {
    const [adv] = await db
      .insert(advertisers)
      .values({
        clerkUserId: `test_${crypto.randomUUID()}`,
        email: 'admin-actions@example.com',
        name: 'Admin Actions Test',
      })
      .returning();
    advertiserId = adv!.id;
  });

  afterEach(async () => {
    if (insertedAdIds.length > 0) {
      await db.delete(ads).where(inArray(ads.id, insertedAdIds));
      insertedAdIds.length = 0;
    }
    await db.delete(advertisers).where(eq(advertisers.id, advertiserId));
    vi.clearAllMocks();
  });

  async function insertAd(status: string, active = true) {
    const [ad] = await db
      .insert(ads)
      .values({
        advertiserId,
        advertiserName: 'Admin Actions Test',
        title: 'Test ad',
        url: 'https://example.com',
        displayUrl: 'example.com',
        description: '',
        ctaText: 'Shop',
        keywords: ['test'],
        bidAmount: 100,
        active,
        status,
      })
      .returning();
    insertedAdIds.push(ad!.id);
    return ad!.id;
  }

  describe('approveAd', () => {
    it('sets status to approved with audit fields', async () => {
      asAdmin();
      const id = await insertAd('pending');

      await approveAd(id);

      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.status).toBe('approved');
      expect(row?.reviewedBy).toBe('admin_clerk_id');
      expect(row?.reviewedAt).toBeInstanceOf(Date);
    });

    it('refuses a non-admin caller', async () => {
      asNonAdmin();
      const id = await insertAd('pending');

      const result = await approveAd(id);

      expect(result).toHaveProperty('error');
      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.status).toBe('pending');
    });
  });

  describe('rejectAd', () => {
    it('sets status to rejected with reason and audit fields', async () => {
      asAdmin();
      const id = await insertAd('pending');

      await rejectAd(id, 'Misleading headline');

      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.status).toBe('rejected');
      expect(row?.rejectionReason).toBe('Misleading headline');
      expect(row?.reviewedBy).toBe('admin_clerk_id');
      expect(row?.reviewedAt).toBeInstanceOf(Date);
    });

    it('refuses an empty reason', async () => {
      asAdmin();
      const id = await insertAd('pending');

      const result = await rejectAd(id, '');

      expect(result).toHaveProperty('error');
      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.status).toBe('pending');
    });

    it('refuses a reason longer than 300 characters', async () => {
      asAdmin();
      const id = await insertAd('pending');

      const result = await rejectAd(id, 'x'.repeat(301));

      expect(result).toHaveProperty('error');
      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.status).toBe('pending');
    });
  });

  describe('suspendAd', () => {
    it('sets active to false', async () => {
      asAdmin();
      const id = await insertAd('approved', true);

      await suspendAd(id);

      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.active).toBe(false);
    });

    it('refuses a non-admin caller', async () => {
      asNonAdmin();
      const id = await insertAd('approved', true);

      const result = await suspendAd(id);

      expect(result).toHaveProperty('error');
      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.active).toBe(true);
    });
  });

  describe('unsuspendAd', () => {
    it('sets active to true', async () => {
      asAdmin();
      const id = await insertAd('approved', false);

      await unsuspendAd(id);

      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.active).toBe(true);
    });

    it('refuses a non-admin caller', async () => {
      asNonAdmin();
      const id = await insertAd('approved', false);

      const result = await unsuspendAd(id);

      expect(result).toHaveProperty('error');
      const [row] = await db.select().from(ads).where(eq(ads.id, id));
      expect(row?.active).toBe(false);
    });
  });

  it('treats an action on a missing ad id as a no-op', async () => {
    asAdmin();
    const result = await approveAd(999_999);
    expect(result).toBeUndefined();
  });
});
