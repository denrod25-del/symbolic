import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { NewsCard } from '@/components/NewsCard';
import { SearchBar } from '@/components/SearchBar';
import { latestArticles } from '@/libs/news';

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: HomePageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'HomePage' });
  return { title: t('meta_title') };
}

export default async function HomePage(props: HomePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const articles = await latestArticles({ limit: 6 });
  const t = await getTranslations('HomePage');
  const tNews = await getTranslations('HomeNews');

  return (
    <>
      <section className="symbolic-hero relative flex min-h-screen flex-col items-center justify-center px-4">
        <h1 className="sr-only">{t('heading')}</h1>
        <div className="relative flex w-full max-w-xl flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <Image
              src="/logo.png"
              alt="Symbolic"
              width={280}
              height={122}
              priority
              className="h-auto w-56 sm:w-[280px]"
            />
            <p className="text-sm text-symbolic-muted">{t('tagline')}</p>
          </div>
          <SearchBar autoFocus />
          <p className="text-center text-xs text-symbolic-muted">
            {t('privacy_note')}
          </p>
        </div>
        {articles.length > 0 && (
          <div className="absolute bottom-6 text-xs tracking-widest text-white/50 uppercase">
            ▾ {tNews('scroll_hint')}
          </div>
        )}
      </section>

      {articles.length > 0 && (
        <section className="bg-symbolic-bg px-4 py-12">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-symbolic-text">
                {tNews('title')}
              </h2>
              <Link
                href={`/${locale}/discover`}
                className="text-sm text-symbolic-accent hover:underline"
              >
                {tNews('more')}
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
