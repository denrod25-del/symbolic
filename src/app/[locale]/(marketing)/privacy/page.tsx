import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type PrivacyPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: PrivacyPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'PrivacyPage' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

const SECTIONS = [
  { titleKey: 'collect_title', bodyKey: 'collect_body' },
  { titleKey: 'cookies_title', bodyKey: 'cookies_body' },
  { titleKey: 'third_parties_title', bodyKey: 'third_parties_body' },
  { titleKey: 'ads_title', bodyKey: 'ads_body' },
  { titleKey: 'retention_title', bodyKey: 'retention_body' },
  { titleKey: 'contact_title', bodyKey: 'contact_body' },
] as const;

export default async function PrivacyPage(props: PrivacyPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('PrivacyPage');

  return (
    <div className="min-h-screen bg-symbolic-bg">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="mb-2 text-3xl font-bold text-symbolic-text">
          {t('title')}
        </h1>
        <p className="mb-10 text-sm text-symbolic-muted">{t('updated')}</p>

        <div className="flex flex-col gap-8">
          {SECTIONS.map((section) => (
            <section key={section.titleKey}>
              <h2 className="mb-2 text-lg font-semibold text-symbolic-text">
                {t(section.titleKey)}
              </h2>
              <p className="leading-relaxed text-symbolic-muted">
                {t(section.bodyKey)}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
