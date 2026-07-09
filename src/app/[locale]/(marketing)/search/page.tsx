import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdCard } from '@/components/AdCard';
import { Pagination } from '@/components/Pagination';
import { ResultsList } from '@/components/ResultsList';
import { SearchLayout } from '@/components/SearchLayout';
import { selectAds } from '@/libs/ads';
import type { Ad } from '@/libs/ads';
import { searchWeb } from '@/libs/brave';

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; offset?: string; lucky?: string }>;
};

export async function generateMetadata(
  props: SearchPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const { q } = await props.searchParams;
  const t = await getTranslations({ locale, namespace: 'SearchPage' });
  return {
    title: q ? t('meta_title_query', { query: q }) : t('meta_title_default'),
  };
}

export default async function SearchPage(props: SearchPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('SearchPage');

  const { q, offset: offsetStr, lucky } = await props.searchParams;
  const query = q?.trim();

  if (!query) {
    redirect('/');
  }

  const offset = Number(offsetStr ?? 0);
  const cookieStore = await cookies();
  const rawSafesearch = cookieStore.get('symbolic_safesearch')?.value;
  const safesearch: 'off' | 'moderate' | 'strict' =
    rawSafesearch === 'off' || rawSafesearch === 'strict'
      ? rawSafesearch
      : 'moderate';

  const [searchResult, adSlots] = await Promise.all([
    searchWeb({ query, offset, safesearch }).catch(() => null),
    selectAds(query).catch((): Ad[] => []),
  ]);

  const results = searchResult;
  const error = searchResult === null ? t('error') : null;

  if (lucky === '1' && results?.results[0]) {
    redirect(results.results[0].url);
  }

  return (
    <SearchLayout query={query}>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="sr-only">{t('heading', { query })}</h1>
        {error && <p className="py-8 text-symbolic-danger">{error}</p>}

        {results && results.results.length === 0 && (
          <div className="py-8">
            <p className="text-symbolic-text">
              {t.rich('no_results', {
                query,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <p className="mt-2 text-sm text-symbolic-muted">
              {t('no_results_hint')}
            </p>
          </div>
        )}

        {results && results.results.length > 0 && (
          <>
            {adSlots[0] && <AdCard ad={adSlots[0]} query={query} />}

            <ResultsList results={results.results} />
            <Pagination
              query={query}
              offset={offset}
              count={results.results.length}
            />

            {adSlots[1] && <AdCard ad={adSlots[1]} query={query} />}
          </>
        )}
      </div>
    </SearchLayout>
  );
}
