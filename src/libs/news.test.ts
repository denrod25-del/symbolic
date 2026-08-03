import { inArray } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newsArticles } from '@/models/Schema';
import { db } from './DB';
import { categorize, refreshAllFeeds } from './news';

function rssXml(
  items: { title: string; link: string; pubDate: string }[]
): string {
  const itemsXml = items
    .map(
      (i) =>
        `<item><title>${i.title}</title><link>${i.link}</link><pubDate>${i.pubDate}</pubDate></item>`
    )
    .join('');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title>${itemsXml}</channel></rss>`;
}

afterEach(async () => {
  await db
    .delete(newsArticles)
    .where(
      inArray(newsArticles.source, [
        'verge',
        'techcrunch',
        'ars',
        'wired',
        'hn',
      ])
    );
  vi.unstubAllGlobals();
});

describe('news', () => {
  describe('categorize', () => {
    it('maps AI titles to ai', () => {
      expect(categorize('OpenAI releases new GPT model')).toBe('ai');
    });

    it('maps funding titles to startups', () => {
      expect(categorize('Acme raises $30M Series A')).toBe('startups');
    });

    it('maps breach titles to security', () => {
      expect(categorize('Massive data breach hits vendor')).toBe('security');
    });

    it('maps hardware titles to devices', () => {
      expect(categorize('New iPhone camera rumors')).toBe('devices');
    });

    it('defaults to general', () => {
      expect(categorize('Netflix changes pricing')).toBe('general');
    });
  });

  describe('refreshAllFeeds', () => {
    it('inserts parsed items and dedupes by url on re-run', async () => {
      const xml = rssXml([
        {
          title: 'GPT-6 announced',
          link: 'https://example.com/gpt6',
          pubDate: 'Fri, 29 May 2026 10:00:00 GMT',
        },
      ]);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => xml,
        })
      );

      const first = await refreshAllFeeds();
      expect(first.inserted).toBeGreaterThan(0);

      const second = await refreshAllFeeds();
      expect(second.inserted).toBe(0);

      const rows = await db.select().from(newsArticles);
      const gpt = rows.filter((r) => r.url === 'https://example.com/gpt6');
      expect(gpt).toHaveLength(1);
      expect(gpt[0]?.category).toBe('ai');
    });

    it('continues when one feed fails', async () => {
      let call = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          call += 1;
          if (call === 1) {
            await Promise.reject(new Error('feed down'));
          }
          return {
            ok: true,
            status: 200,
            text: () =>
              rssXml([
                {
                  title: `Story ${call}`,
                  link: `https://example.com/${call}`,
                  pubDate: 'Fri, 29 May 2026 10:00:00 GMT',
                },
              ]),
          };
        })
      );

      const result = await refreshAllFeeds();
      expect(result.failedSources).toHaveLength(1);
      expect(result.inserted).toBeGreaterThan(0);
    });
  });
});
