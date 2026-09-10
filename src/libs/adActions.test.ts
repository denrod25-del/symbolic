import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ads, advertisers } from '@/models/Schema';
import { createAd, deleteAd, toggleAdActive, updateAd } from './adActions';
import { db } from './DB';

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
}));

// Import after mock so the mock is in place
const { currentUser } = await import('@clerk/nextjs/server');
const mockCurrentUser = vi.mocked(currentUser);

const validData = {
  title: 'Best running shoes',
  url: 'https://example.com/shoes',
  displayUrl: 'example.com/shoes',
  description: 'Top quality shoes for runners.',
  ctaText: 'Shop Now',
  keywords: 'running, shoes, trainers',
  bidPounds: '0.50',
};

describe('adActions', () => {
  let clerkId: string;
  let advertiserId: number;

  beforeEach(async () => {
    clerkId = `test_${crypto.randomUUID()}`;
    const [adv] = await db
      .insert(advertisers)
      .values({
        clerkUserId: clerkId,
        email: 'test@example.com',
        name: 'Test Advertiser',
      })
      .returning();
    advertiserId = adv!.id;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    mockCurrentUser.mockResolvedValue({ id: clerkId } as never);
  });

  afterEach(async () => {
    await db.delete(ads).where(eq(ads.advertiserId, advertiserId));
    await db.delete(advertisers).where(eq(advertisers.id, advertiserId));
    vi.clearAllMocks();
  });

  describe('createAd', () => {
    it('inserts an ad row and returns success', async () => {
      const result = await createAd(validData);

      expect(result).toEqual({ success: true });

      const rows = await db
        .select()
        .from(ads)
        .where(eq(ads.advertiserId, advertiserId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.title).toBe('Best running shoes');
      expect(rows[0]?.bidAmount).toBe(50); // $0.50 = 50 cents
      expect(rows[0]?.keywords).toEqual(['running', 'shoes', 'trainers']);
      expect(rows[0]?.active).toBe(true);
    });

    it('returns error for invalid URL', async () => {
      const result = await createAd({ ...validData, url: 'not-a-url' });

      expect(result).toHaveProperty('error');
      const rows = await db
        .select()
        .from(ads)
        .where(eq(ads.advertiserId, advertiserId));
      expect(rows).toHaveLength(0);
    });

    it('returns error for bid below minimum ($0.10 = 10 cents)', async () => {
      const result = await createAd({ ...validData, bidPounds: '0.05' });

      expect(result).toHaveProperty('error');
      const rows = await db
        .select()
        .from(ads)
        .where(eq(ads.advertiserId, advertiserId));
      expect(rows).toHaveLength(0);
    });
  });

  describe('updateAd', () => {
    it('updates the ad and returns success', async () => {
      const [ad] = await db
        .insert(ads)
        .values({
          advertiserId,
          advertiserName: 'Test Advertiser',
          title: 'Old title',
          url: 'https://old.com',
          displayUrl: 'old.com',
          description: '',
          ctaText: 'Click',
          keywords: ['old'],
          bidAmount: 20,
          active: true,
        })
        .returning();

      const result = await updateAd(ad!.id, {
        ...validData,
        title: 'New title',
      });

      expect(result).toEqual({ success: true });

      const [updated] = await db.select().from(ads).where(eq(ads.id, ad!.id));
      expect(updated?.title).toBe('New title');
    });

    it('returns error when ad belongs to another advertiser', async () => {
      // Create a second advertiser
      const otherId = `test_${crypto.randomUUID()}`;
      const [other] = await db
        .insert(advertisers)
        .values({
          clerkUserId: otherId,
          email: 'other@example.com',
          name: 'Other',
        })
        .returning();

      const [ad] = await db
        .insert(ads)
        .values({
          advertiserId: other!.id,
          advertiserName: 'Other',
          title: 'Not yours',
          url: 'https://other.com',
          displayUrl: 'other.com',
          description: '',
          ctaText: 'Go',
          keywords: ['other'],
          bidAmount: 10,
          active: true,
        })
        .returning();

      // Current user is clerkId (not otherId)
      const result = await updateAd(ad!.id, validData);
      expect(result).toHaveProperty('error');

      // Cleanup
      await db.delete(ads).where(eq(ads.id, ad!.id));
      await db.delete(advertisers).where(eq(advertisers.id, other!.id));
    });
  });

  describe('toggleAdActive', () => {
    it('flips active from true to false', async () => {
      const [ad] = await db
        .insert(ads)
        .values({
          advertiserId,
          advertiserName: 'Test Advertiser',
          title: 'Toggle me',
          url: 'https://example.com',
          displayUrl: 'example.com',
          description: '',
          ctaText: 'Click',
          keywords: ['test'],
          bidAmount: 10,
          active: true,
        })
        .returning();

      await toggleAdActive(ad!.id, 'en');

      const [updated] = await db.select().from(ads).where(eq(ads.id, ad!.id));
      expect(updated?.active).toBe(false);
    });

    it('flips active from false to true', async () => {
      const [ad] = await db
        .insert(ads)
        .values({
          advertiserId,
          advertiserName: 'Test Advertiser',
          title: 'Resume me',
          url: 'https://example.com',
          displayUrl: 'example.com',
          description: '',
          ctaText: 'Click',
          keywords: ['test'],
          bidAmount: 10,
          active: false,
        })
        .returning();

      await toggleAdActive(ad!.id, 'en');

      const [updated] = await db.select().from(ads).where(eq(ads.id, ad!.id));
      expect(updated?.active).toBe(true);
    });
  });

  describe('deleteAd', () => {
    it('removes the ad row', async () => {
      const [ad] = await db
        .insert(ads)
        .values({
          advertiserId,
          advertiserName: 'Test Advertiser',
          title: 'Delete me',
          url: 'https://example.com',
          displayUrl: 'example.com',
          description: '',
          ctaText: 'Click',
          keywords: ['test'],
          bidAmount: 10,
          active: true,
        })
        .returning();

      await deleteAd(ad!.id, 'en');

      const rows = await db.select().from(ads).where(eq(ads.id, ad!.id));
      expect(rows).toHaveLength(0);
    });

    it('does not delete an ad owned by another advertiser', async () => {
      const otherId = `test_${crypto.randomUUID()}`;
      const [other] = await db
        .insert(advertisers)
        .values({
          clerkUserId: otherId,
          email: 'other2@example.com',
          name: 'Other2',
        })
        .returning();

      const [ad] = await db
        .insert(ads)
        .values({
          advertiserId: other!.id,
          advertiserName: 'Other2',
          title: 'Not yours',
          url: 'https://other2.com',
          displayUrl: 'other2.com',
          description: '',
          ctaText: 'Go',
          keywords: ['x'],
          bidAmount: 10,
          active: true,
        })
        .returning();

      await deleteAd(ad!.id, 'en');

      // Ad should still exist because it belongs to another advertiser
      const rows = await db.select().from(ads).where(eq(ads.id, ad!.id));
      expect(rows).toHaveLength(1);

      // Cleanup
      await db.delete(ads).where(eq(ads.id, ad!.id));
      await db.delete(advertisers).where(eq(advertisers.id, other!.id));
    });
  });
});
