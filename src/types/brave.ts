export type SearchResult = {
  type: 'search_result';
  title: string;
  url: string;
  description: string;
  meta_url: {
    scheme: string;
    netloc: string;
    path: string;
  };
};

export type BraveSearchResponse = {
  type: 'search';
  query: {
    original: string;
    altered?: string;
  };
  web?: {
    type: 'search';
    results: SearchResult[];
  };
};
