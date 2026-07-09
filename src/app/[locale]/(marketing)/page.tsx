import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { SearchBar } from '@/components/SearchBar';

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
  const t = await getTranslations('HomePage');

  return (
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
    </section>
  );
}
