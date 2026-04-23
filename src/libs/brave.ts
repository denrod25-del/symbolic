import type { BraveSearchResponse, SearchResult } from '@/types/brave';

const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';

export type SearchOptions = {
  query: string;
  offset?: number;
  count?: number;
  safesearch?: 'off' | 'moderate' | 'strict';
};

export type SearchResults = {
  results: SearchResult[];
  query: string;
  altered?: string;
};

export async function searchWeb(
  options: SearchOptions
): Promise<SearchResults> {
  const { query, offset = 0, count = 10, safesearch = 'moderate' } = options;

  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error('BRAVE_SEARCH_API_KEY is not set');
  }

  const url = new URL(BRAVE_API_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('count', String(count));
  url.searchParams.set('safesearch', safesearch);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
    next: { revalidate: 60 },
  } as RequestInit);

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status}`);
  }

  const data: BraveSearchResponse = await response.json();

  return {
    results: data.web?.results ?? [],
    query: data.query.original,
    altered: data.query.altered,
  };
}
