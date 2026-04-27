import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { advertisers } from '@/models/Schema';
import { ensureAdvertiser } from './advertisers';
import { db } from './DB';

describe('ensureAdvertiser', () => {
  let testClerkId: string;

  beforeEach(() => {
    testClerkId = `test_${crypto.randomUUID()}`;
  });

  afterEach(async () => {
    await db
      .delete(advertisers)
      .where(eq(advertisers.clerkUserId, testClerkId));
  });

  it('inserts an advertiser row on first call', async () => {
    await ensureAdvertiser(testClerkId, 'test@example.com', 'Test User');

    const rows = await db
      .select()
      .from(advertisers)
      .where(eq(advertisers.clerkUserId, testClerkId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe('test@example.com');
    expect(rows[0]?.name).toBe('Test User');
  });

  it('creates exactly one row when called twice with the same clerkUserId', async () => {
    await ensureAdvertiser(testClerkId, 'test@example.com', 'Test User');
    await ensureAdvertiser(testClerkId, 'test@example.com', 'Test User');

    const rows = await db
      .select()
      .from(advertisers)
      .where(eq(advertisers.clerkUserId, testClerkId));

    expect(rows).toHaveLength(1);
  });
});
