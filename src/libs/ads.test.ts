import { eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ads, advertisers } from '@/models/Schema';
import { selectAds } from './ads';
import { db } from './DB';

describe('selectAds', () => {
  let advertiserId: number;
  const insertedAdIds: number[] = [];

  beforeEach(async () => {
    const [adv] = await db
      .insert(advertisers)
      .values({
        clerkUserId: `test_${crypto.randomUUID()}`,
        email: 'ads-test@example.com',
        name: 'Ads Test',
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
  });

  async function insertAd(status: string, active: boolean) {
    const [ad] = await db
      .insert(ads)
      .values({
        advertiserId,
        advertiserName: 'Ads Test',
        title: 'Running shoes',
        url: 'https://example.com',
        displayUrl: 'example.com',
        description: '',
        ctaText: 'Shop',
        keywords: ['running'],
        bidAmount: 100,
        active,
        status,
      })
      .returning();
    insertedAdIds.push(ad!.id);
    return ad!.id;
  }

  it('includes an approved active ad', async () => {
    const id = await insertAd('approved', true);
    const result = await selectAds('running');
    expect(result.map((ad) => ad.id)).toContain(id);
  });

  it('excludes a pending ad', async () => {
    const id = await insertAd('pending', true);
    const result = await selectAds('running');
    expect(result.map((ad) => ad.id)).not.toContain(id);
  });

  it('excludes a rejected ad', async () => {
    const id = await insertAd('rejected', true);
    const result = await selectAds('running');
    expect(result.map((ad) => ad.id)).not.toContain(id);
  });

  it('excludes an approved but inactive ad', async () => {
    const id = await insertAd('approved', false);
    const result = await selectAds('running');
    expect(result.map((ad) => ad.id)).not.toContain(id);
  });
});
