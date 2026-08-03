import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newsPreferences } from '@/models/Schema';
import { db } from './DB';
import { getHiddenSources, setHiddenSources } from './newsPreferences';

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(),
}));

const { currentUser } = await import('@clerk/nextjs/server');
const mockCurrentUser = vi.mocked(currentUser);

const TEST_ID = 'news_prefs_test_user';

afterEach(async () => {
  await db
    .delete(newsPreferences)
    .where(eq(newsPreferences.clerkUserId, TEST_ID));
  vi.clearAllMocks();
});

describe('newsPreferences', () => {
  it('saves and loads hidden sources for a signed-in user', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    mockCurrentUser.mockResolvedValue({ id: TEST_ID } as never);

    await setHiddenSources(['wired', 'hn']);
    expect(await getHiddenSources()).toEqual(['wired', 'hn']);

    await setHiddenSources(['verge']);
    expect(await getHiddenSources()).toEqual(['verge']);
  });

  it('returns empty for anonymous users', async () => {
    mockCurrentUser.mockResolvedValue(null);
    expect(await getHiddenSources()).toEqual([]);
  });

  it('refuses to save for anonymous users', async () => {
    mockCurrentUser.mockResolvedValue(null);
    const result = await setHiddenSources(['wired']);
    expect(result).toHaveProperty('error');
  });

  it('rejects unknown source keys', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    mockCurrentUser.mockResolvedValue({ id: TEST_ID } as never);
    const result = await setHiddenSources(['notasource']);
    expect(result).toHaveProperty('error');
  });
});
