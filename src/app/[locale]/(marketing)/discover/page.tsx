import { currentUser } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { NewsCard } from '@/components/NewsCard';
import type { NewsCategory } from '@/libs/news';
import { latestArticles } from '@/libs/news';
import { getHiddenSources } from '@/libs/newsPreferences';
import { SourcesPopover } from './SourcesPopover';

const TABS = ['all', 'ai', 'startups', 'security', 'devices'] as const;

type Tab = (typeof TABS)[number];

function isTab(value: string | undefined): value is Tab {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return TABS.includes(value as Tab);
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'DiscoverPage' });
  return { title: t('meta_title'), description: t('meta_description') };
}

export default async function DiscoverPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const { category } = await props.searchParams;
  const tab: Tab = isTab(category) ? category : 'all';
  const t = await getTranslations('DiscoverPage');

  const user = await currentUser();
  const hiddenSources = await getHiddenSources();

  const newsCategory: NewsCategory | undefined =
    tab === 'all' ? undefined : tab;

  const articles = await latestArticles({
    category: newsCategory,
    hiddenSources,
    limit: 24,
  });

  return (
    <div className="min-h-screen bg-symbolic-bg text-symbolic-text">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <SourcesPopover
            signedIn={Boolean(user)}
            hiddenSources={hiddenSources}
            labels={{ sources: t('sources'), signin: t('sources_signin') }}
          />
        </div>

        <div className="mb-8 flex gap-2">
          {TABS.map((value) => (
            <Link
              key={value}
              href={`/${locale}/discover?category=${value}`}
              className={`rounded px-3 py-1 text-xs font-semibold ${
                tab === value
                  ? 'bg-symbolic-accent text-symbolic-bg'
                  : 'border border-symbolic-border text-symbolic-muted hover:text-symbolic-text'
              }`}
            >
              {t(`tab_${value}`)}
            </Link>
          ))}
        </div>

        {articles.length === 0 ? (
          <p className="rounded-lg border border-symbolic-border bg-symbolic-surface px-6 py-16 text-center text-symbolic-muted">
            {t('empty')}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
