import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { ensureBookingSettings } from '@/libs/bookingSettingsActions';
import { Env } from '@/libs/Env';
import { BookingSettingsForm } from './BookingSettingsForm';

export default async function CrmBookingPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CrmBookingPage');

  const settings = await ensureBookingSettings();
  if (!settings) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const base = Env.NEXT_PUBLIC_APP_URL ?? '';
  const publicUrl = `${base}/${locale}/book/${settings.slug}`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="mb-8 text-sm text-white/50">{t('subtitle')}</p>

      <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-6">
        <p className="mb-2 text-sm font-semibold text-white/70">
          {t('link_heading')}
        </p>
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm break-all text-indigo-400 hover:underline"
        >
          {publicUrl}
        </a>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('settings_heading')}
        </h2>
        <BookingSettingsForm
          initial={{
            businessName: settings.businessName,
            enabled: settings.enabled,
            defaultDurationMinutes: settings.defaultDurationMinutes,
          }}
          locale={locale}
        />
      </div>
    </div>
  );
}
