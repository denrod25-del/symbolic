import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { NewsCard } from '@/components/NewsCard';
import { SearchBar } from '@/components/SearchBar';
import { latestArticles } from '@/libs/news';

export const metadata: Metadata = {
  title: 'Symbolic — Search without compromise',
};

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage(props: HomePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const articles = await latestArticles({ limit: 6 });
  const t = await getTranslations('HomeNews');

  return (
    <>
      <section
        className="relative flex min-h-screen flex-col items-center justify-center px-4"
        style={{
          backgroundImage: 'url(/earth.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: '50% 30%',
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative flex w-full max-w-xl flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <Image
              src="/logo.png"
              alt="Symbolic"
              width={280}
              height={122}
              priority
            />
            <p className="text-sm text-symbolic-muted">
              Search without compromise
            </p>
          </div>
          <SearchBar autoFocus />
        </div>
        {articles.length > 0 && (
          <div className="absolute bottom-6 text-xs tracking-widest text-white/50 uppercase">
            ▾ {t('scroll_hint')}
          </div>
        )}
      </section>

      {articles.length > 0 && (
        <section className="bg-symbolic-bg px-4 py-12">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-symbolic-text">
                {t('title')}
              </h2>
              <Link
                href={`/${locale}/discover`}
                className="text-sm text-symbolic-accent hover:underline"
              >
                {t('more')}
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
