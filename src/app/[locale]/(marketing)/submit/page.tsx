import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

const BRAVE_WEBMASTER_URL =
  'https://search.brave.com/help/webmaster-search-portal';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'SubmitPage' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function SubmitPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('SubmitPage');

  return (
    <div className="min-h-screen bg-symbolic-bg">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="mb-4 text-3xl font-bold text-symbolic-text">
          {t('title')}
        </h1>
        <p className="mb-6 text-symbolic-text">{t('intro')}</p>
        <a
          href={BRAVE_WEBMASTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg bg-symbolic-accent px-6 py-3 font-semibold text-symbolic-bg transition-colors hover:opacity-90"
        >
          {t('cta')}
        </a>
        <p className="mt-8 text-sm text-symbolic-muted">{t('note')}</p>
      </div>
    </div>
  );
}
