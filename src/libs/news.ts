import { and, desc, eq, notInArray } from 'drizzle-orm';
import Parser from 'rss-parser';
import { newsArticles } from '@/models/Schema';
import { db } from './DB';

export const NEWS_SOURCES = {
  verge: 'https://www.theverge.com/rss/index.xml',
  techcrunch: 'https://techcrunch.com/feed/',
  ars: 'https://feeds.arstechnica.com/arstechnica/index',
  wired: 'https://www.wired.com/feed/rss',
  hn: 'https://hnrss.org/frontpage',
} as const;

export type NewsSource = keyof typeof NEWS_SOURCES;
export type NewsCategory =
  | 'ai'
  | 'startups'
  | 'security'
  | 'devices'
  | 'general';

const CATEGORY_RULES: { category: NewsCategory; re: RegExp }[] = [
  {
    category: 'ai',
    re: /\bai\b|gpt|llm|openai|anthropic|machine learning|neural|chatbot|copilot/i,
  },
  {
    category: 'startups',
    re: /raises|funding|series [a-e]\b|seed round|valuation|startup|acquisition|acquires/i,
  },
  {
    category: 'security',
    re: /breach|vulnerabilit|cve-|ransomware|malware|hack(ed|ers?)|zero-day|exploit|phishing/i,
  },
  {
    category: 'devices',
    re: /iphone|android|laptop|macbook|chip|processor|gpu|console|pixel|galaxy|headset|wearable/i,
  },
];

/**
 * Categorizes an article title with keyword rules.
 * @param title - The article title.
 * @returns The matched category, or general.
 */
export function categorize(title: string): NewsCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(title)) {
      return rule.category;
    }
  }
  return 'general';
}

type FeedItem = {
  title: string;
  url: string;
  imageUrl: string | null;
  publishedAt: Date;
};

type CustomItem = { mediaContent?: { $?: { url?: string } } };

const parser = new Parser<Record<string, unknown>, CustomItem>({
  customFields: { item: [['media:content', 'mediaContent']] },
});

function hasTitleAndLink(
  item: Parser.Item & CustomItem
): item is Parser.Item & CustomItem & { title: string; link: string } {
  return typeof item.title === 'string' && typeof item.link === 'string';
}

async function fetchFeed(url: string): Promise<FeedItem[]> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'SymbolicNewsBot/1.0 (+https://bsymbolic.com)' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Feed error ${response.status}: ${url}`);
  }
  const xml = await response.text();
  const feed = await parser.parseString(xml);

  return feed.items.filter(hasTitleAndLink).map((item) => {
    const enclosureUrl = item.enclosure?.url;
    return {
      title: item.title,
      url: item.link,
      imageUrl: item.mediaContent?.$?.url ?? enclosureUrl ?? null,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
    };
  });
}

export type RefreshResult = { inserted: number; failedSources: string[] };

/**
 * Fetches every configured feed, categorizes items, and inserts new articles.
 * Each feed is independent; one failure never blocks the others.
 * @returns Counts of inserted articles and any failed source keys.
 */
export async function refreshAllFeeds(): Promise<RefreshResult> {
  let inserted = 0;
  const failedSources: string[] = [];

  for (const [source, url] of Object.entries(NEWS_SOURCES)) {
    try {
      const items = await fetchFeed(url);
      for (const item of items) {
        const result = await db
          .insert(newsArticles)
          .values({
            source,
            category: categorize(item.title),
            title: item.title,
            url: item.url,
            imageUrl: item.imageUrl,
            publishedAt: item.publishedAt,
          })
          .onConflictDoNothing({ target: newsArticles.url })
          .returning({ id: newsArticles.id });
        inserted += result.length;
      }
    } catch {
      failedSources.push(source);
    }
  }

  return { inserted, failedSources };
}

/**
 * Returns the latest articles, optionally filtered by category and
 * excluding hidden sources.
 * @param options - Category filter, hidden sources, and row limit.
 * @returns The matching article rows, newest first.
 */
export function latestArticles(options: {
  category?: NewsCategory;
  hiddenSources?: string[];
  limit: number;
}) {
  const conditions = [];
  if (options.category) {
    conditions.push(eq(newsArticles.category, options.category));
  }
  if (options.hiddenSources && options.hiddenSources.length > 0) {
    conditions.push(notInArray(newsArticles.source, options.hiddenSources));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select()
    .from(newsArticles)
    .where(where)
    .orderBy(desc(newsArticles.publishedAt))
    .limit(options.limit);
}
