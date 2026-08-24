import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ensureAdvertiser } from '@/libs/advertisers';
import { db } from '@/libs/DB';
import { ads, advertisers } from '@/models/Schema';
import { formatUsd } from '@/utils/Money';

const LOW_BALANCE_CENTS = 500;

export default async function DashboardPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('AdvertiseDashboardPage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const email = user.emailAddresses[0]?.emailAddress ?? '';
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || email;

  await ensureAdvertiser(user.id, email, name);

  const [advertiser] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, user.id))
    .limit(1);

  const activeAdsRows = advertiser
    ? await db
        .select({ id: ads.id })
        .from(ads)
        .where(eq(ads.advertiserId, advertiser.id))
    : [];

  const activeAdsCount = activeAdsRows.length;
  const balanceCents = advertiser?.balanceCents ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('greeting', { name })}</h1>

      {balanceCents <= 0 && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {t('no_funds_warning')}{' '}
          <Link className="underline" href={`/${locale}/advertise/billing`}>
            {t('manage_billing')}
          </Link>
        </div>
      )}
      {balanceCents > 0 && balanceCents < LOW_BALANCE_CENTS && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {t('low_balance_warning')}{' '}
          <Link className="underline" href={`/${locale}/advertise/billing`}>
            {t('manage_billing')}
          </Link>
        </div>
      )}

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">{t('active_ads_label')}</p>
          <p className="text-3xl font-bold">{activeAdsCount}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">{t('budget_label')}</p>
          <p className="text-3xl font-bold">{t('budget_placeholder')}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">{t('balance_label')}</p>
          <p className="text-3xl font-bold">{formatUsd(balanceCents)}</p>
        </div>
      </div>

      <Link
        href={`/${locale}/advertise/create`}
        className="block w-full rounded-lg bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-500"
      >
        {t('create_first_ad')}
      </Link>
    </div>
  );
}
