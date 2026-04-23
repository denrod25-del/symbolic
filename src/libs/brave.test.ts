import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchWeb } from './brave';

const MOCK_RESPONSE = {
  type: 'search',
  query: { original: 'test query' },
  web: {
    type: 'search',
    results: [
      {
        type: 'search_result',
        title: 'Test Result',
        url: 'https://example.com',
        description: 'A test result description',
        meta_url: { scheme: 'https', netloc: 'example.com', path: '/' },
      },
    ],
  },
};

function mockJson(value: unknown) {
  return  async () => Promise.resolve(value);
}

describe('searchWeb', () => {
  beforeEach(() => {
    vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-api-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: mockJson(MOCK_RESPONSE),
      })
    );
  });

  it('returns shaped results from Brave API response', async () => {
    const result = await searchWeb({ query: 'test query' });

    expect(result.query).toBe('test query');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.title).toBe('Test Result');
    expect(result.results[0]?.url).toBe('https://example.com');
  });

  it('returns empty array when web results are absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: mockJson({ type: 'search', query: { original: 'test' } }),
      })
    );

    const result = await searchWeb({ query: 'test' });
    expect(result.results).toEqual([]);
  });

  it('passes query and offset as URL params', async () => {
    await searchWeb({ query: 'hello', offset: 10 });

    const [fetchCall] = vi.mocked(fetch).mock.calls;
    const [rawUrl] = fetchCall ?? [];
    const url = new URL(typeof rawUrl === 'string' ? rawUrl : '');
    expect(url.searchParams.get('q')).toBe('hello');
    expect(url.searchParams.get('offset')).toBe('10');
  });

  it('throws on API error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );

    await expect(searchWeb({ query: 'test' })).rejects.toThrow(
      'Brave Search API error: 500'
    );
  });

  it('throws when API key is missing', async () => {
    vi.stubEnv('BRAVE_SEARCH_API_KEY', '');

    await expect(searchWeb({ query: 'test' })).rejects.toThrow(
      'BRAVE_SEARCH_API_KEY is not set'
    );
  });
});
