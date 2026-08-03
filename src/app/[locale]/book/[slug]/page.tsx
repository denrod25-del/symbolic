import { eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/libs/DB';
import { crmBookingSettings } from '@/models/Schema';
import { PublicBookingForm } from './PublicBookingForm';

export default async function PublicBookingPage(props: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('PublicBookingPage');

  const [settings] = await db
    .select({
      businessName: crmBookingSettings.businessName,
      enabled: crmBookingSettings.enabled,
    })
    .from(crmBookingSettings)
    .where(eq(crmBookingSettings.slug, slug))
    .limit(1);

  return (
    <div className="min-h-screen bg-[#0d0d14] px-6 py-16 text-white">
      <div className="mx-auto max-w-lg">
        {!settings || !settings.enabled ? (
          <p className="text-sm text-white/50">{t('unavailable')}</p>
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-bold">
              {settings.businessName
                ? t('title_named', { name: settings.businessName })
                : t('title')}
            </h1>
            <p className="mb-8 text-sm text-white/50">{t('subtitle')}</p>
            <div className="rounded-lg border border-white/10 bg-white/5 p-6">
              <PublicBookingForm slug={slug} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
