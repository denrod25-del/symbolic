import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock DB before importing the module under test
vi.mock('./DB', () => ({
  db: {
    select: vi.fn(),
  },
}));

// eslint-disable-next-line import/first
import { selectAds, tokenize } from './ads';
// eslint-disable-next-line import/first
import { db } from './DB';

describe('tokenize', () => {
  it('splits on whitespace', () => {
    expect(tokenize('running shoes')).toEqual(['running', 'shoes']);
  });

  it('splits on punctuation', () => {
    expect(tokenize('buy, shoes!')).toEqual(['buy', 'shoes']);
  });

  it('lowercases all tokens', () => {
    expect(tokenize('Running SHOES')).toEqual(['running', 'shoes']);
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(tokenize('   ')).toEqual([]);
  });

  it('filters out empty strings from splits', () => {
    expect(tokenize('a,,b')).toEqual(['a', 'b']);
  });
});

describe('selectAds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array without querying db when query tokenises to nothing', async () => {
    const result = await selectAds('');
    expect(result).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const selectMock = vi.mocked(db.select);
    expect(selectMock.mock.calls).toHaveLength(0);
  });

  it('returns empty array without querying db for punctuation-only query', async () => {
    const result = await selectAds('...');
    expect(result).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const selectMock = vi.mocked(db.select);
    expect(selectMock.mock.calls).toHaveLength(0);
  });

  it('queries db when tokens are present', async () => {
    const mockRows = [
      {
        id: 1,
        title: 'Buy Shoes',
        url: 'https://shoes.example.com',
        displayUrl: 'shoes.example.com',
        description: 'Great shoes',
        ctaText: 'Shop Now →',
        keywords: ['running', 'shoes'],
        bidAmount: 100,
        active: true,
        advertiserName: 'Shoes Co',
        createdAt: new Date(),
      },
    ];
    const mockLimit = vi.fn().mockResolvedValue(mockRows);
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const selectMock = vi.mocked(db.select);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    selectMock.mockReturnValue({ from: mockFrom } as unknown as ReturnType<
      typeof db.select
    >);

    const result = await selectAds('running shoes');
    expect(selectMock.mock.calls).toHaveLength(1);
    expect(result).toEqual(mockRows);
  });
});
