import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Pagination } from '@/components/Pagination';
import { ResultsList } from '@/components/ResultsList';
import { SearchLayout } from '@/components/SearchLayout';
import { searchWeb } from '@/libs/brave';

type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; offset?: string; lucky?: string }>;
};

export async function generateMetadata(
  props: SearchPageProps
): Promise<Metadata> {
  const { q } = await props.searchParams;
  return { title: q ? `${q} — Symbolic` : 'Search — Symbolic' };
}

export default async function SearchPage(props: SearchPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

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

  let results: Awaited<ReturnType<typeof searchWeb>> | null = null;
  let error: string | null = null;

  try {
    results = await searchWeb({ query, offset, safesearch });
  } catch {
    error = 'Something went wrong. Please try again.';
  }

  if (lucky === '1' && results?.results[0]) {
    redirect(results.results[0].url);
  }

  return (
    <SearchLayout query={query}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        {error && <p className="py-8 text-red-400">{error}</p>}

        {results && results.results.length === 0 && (
          <div className="py-8">
            <p className="text-symbolic-text">
              No results found for <strong>&ldquo;{query}&rdquo;</strong>
            </p>
            <p className="mt-2 text-sm text-symbolic-muted">
              Try different keywords or check your spelling.
            </p>
          </div>
        )}

        {results && results.results.length > 0 && (
          <>
            {/* Ad slot — reserved for Phase 2 */}
            <div data-slot="ad-top" className="hidden" aria-hidden="true" />

            <ResultsList results={results.results} />
            <Pagination
              query={query}
              offset={offset}
              count={results.results.length}
            />
          </>
        )}
      </main>
    </SearchLayout>
  );
}
