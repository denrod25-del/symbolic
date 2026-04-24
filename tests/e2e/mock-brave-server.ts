import { createServer } from 'node:http';
import type { Server } from 'node:http';

const MOCK_RESULTS = {
  type: 'search',
  query: { original: 'hello world' },
  web: {
    type: 'search',
    results: [
      {
        type: 'search_result',
        title: 'Hello World — Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Hello_World',
        description:
          'A hello world program outputs the text "Hello, World!" to the screen.',
        meta_url: {
          scheme: 'https',
          netloc: 'en.wikipedia.org',
          path: '/wiki/Hello_World',
        },
      },
    ],
  },
};

const EMPTY_RESULTS = {
  type: 'search',
  query: { original: 'xyzzy12345' },
  web: { type: 'search', results: [] },
};

export function createMockBraveServer(): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost`);
    const query = url.searchParams.get('q') ?? '';

    res.setHeader('Content-Type', 'application/json');

    if (query === 'error') {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
      return;
    }

    if (query === 'empty' || query === 'xyzzy12345') {
      res.writeHead(200);
      res.end(JSON.stringify(EMPTY_RESULTS));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify(MOCK_RESULTS));
  });
}
