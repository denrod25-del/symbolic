import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { WeatherPageContent } from '@/components/WeatherPageContent';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'WeatherPage' });
  return { title: t('meta_title') };
}

export default async function WeatherPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('WeatherPage');

  return (
    <div className="min-h-screen bg-symbolic-bg text-symbolic-text">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>
        <WeatherPageContent locale={locale} />
      </div>
    </div>
  );
}
