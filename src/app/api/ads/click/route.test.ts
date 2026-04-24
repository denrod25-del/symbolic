import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { GET } from './route';

vi.mock('@/libs/DB', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

const makeRequest = (params: Record<string, string>) => {
  const url = new URL('http://localhost/api/ads/click');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
};

describe('GET /api/ads/click', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when id param is missing', async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when id is not a positive integer', async () => {
    const res = await GET(makeRequest({ id: 'abc' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when id is zero', async () => {
    const res = await GET(makeRequest({ id: '0' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when id is a float', async () => {
    const res = await GET(makeRequest({ id: '1.5' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when ad is not found', async () => {
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const selectMock = vi.mocked(db.select);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    selectMock.mockReturnValue({ from: mockFrom } as unknown as ReturnType<
      typeof db.select
    >);

    const res = await GET(makeRequest({ id: '99' }));
    expect(res.status).toBe(404);
  });

  it('returns 404 when ad is inactive', async () => {
    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 1, active: false, url: 'https://example.com' },
      ]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const selectMock = vi.mocked(db.select);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    selectMock.mockReturnValue({ from: mockFrom } as unknown as ReturnType<
      typeof db.select
    >);

    const res = await GET(makeRequest({ id: '1' }));
    expect(res.status).toBe(404);
  });

  it('records click and redirects to ad url', async () => {
    const adUrl = 'https://shoes.example.com';
    const mockSelectLimit = vi
      .fn()
      .mockResolvedValue([{ id: 1, active: true, url: adUrl }]);
    const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockSelectLimit });
    const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const selectMock = vi.mocked(db.select);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    selectMock.mockReturnValue({
      from: mockSelectFrom,
    } as unknown as ReturnType<typeof db.select>);

    const mockInsertValues = vi.fn().mockReturnValue(Promise.resolve());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const insertMock = vi.mocked(db.insert);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    insertMock.mockReturnValue({
      values: mockInsertValues,
    } as unknown as ReturnType<typeof db.insert>);

    const res = await GET(makeRequest({ id: '1', q: 'running shoes' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(adUrl);
    expect(mockInsertValues).toHaveBeenCalledOnce();
    expect(mockInsertValues).toHaveBeenCalledWith({
      adId: 1,
      query: 'running shoes',
    });
  });

  it('redirects to ad url even with no q param', async () => {
    const adUrl = 'https://shoes.example.com';
    const mockSelectLimit = vi
      .fn()
      .mockResolvedValue([{ id: 1, active: true, url: adUrl }]);
    const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockSelectLimit });
    const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const selectMock = vi.mocked(db.select);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    selectMock.mockReturnValue({
      from: mockSelectFrom,
    } as unknown as ReturnType<typeof db.select>);

    const mockInsertValues = vi.fn().mockReturnValue(Promise.resolve());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const insertMock = vi.mocked(db.insert);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    insertMock.mockReturnValue({
      values: mockInsertValues,
    } as unknown as ReturnType<typeof db.insert>);

    const res = await GET(makeRequest({ id: '1' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(adUrl);
  });

  it('redirects even when insert throws', async () => {
    const adUrl = 'https://shoes.example.com';
    const mockSelectLimit = vi
      .fn()
      .mockResolvedValue([{ id: 1, active: true, url: adUrl }]);
    const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockSelectLimit });
    const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const selectMock2 = vi.mocked(db.select);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    selectMock2.mockReturnValue({
      from: mockSelectFrom,
    } as unknown as ReturnType<typeof db.select>);

    const mockInsertValues = vi.fn().mockRejectedValue(new Error('DB error'));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const insertMock2 = vi.mocked(db.insert);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    insertMock2.mockReturnValue({
      values: mockInsertValues,
    } as unknown as ReturnType<typeof db.insert>);

    const res = await GET(makeRequest({ id: '1', q: 'shoes' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(adUrl);
  });
});
