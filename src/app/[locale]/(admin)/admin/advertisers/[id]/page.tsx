import { desc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { db } from '@/libs/DB';
import { ads, advertisers } from '@/models/Schema';

type DetailTranslator = Awaited<
  ReturnType<typeof getTranslations<'AdminAdvertiserDetailPage'>>
>;

function badgeLabel(
  ad: { status: string; active: boolean },
  t: DetailTranslator
): string {
  if (ad.status === 'pending') {
    return t('status_pending');
  }
  if (ad.status === 'rejected') {
    return t('status_rejected');
  }
  if (ad.active) {
    return t('status_approved_active');
  }
  return t('status_approved_paused');
}

export default async function AdminAdvertiserDetailPage(props: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('AdminAdvertiserDetailPage');

  const advertiserId = Number(id);
  if (!Number.isInteger(advertiserId) || advertiserId <= 0) {
    notFound();
  }

  const [advertiser] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.id, advertiserId))
    .limit(1);

  if (!advertiser) {
    notFound();
  }

  const advertiserAds = await db
    .select()
    .from(ads)
    .where(eq(ads.advertiserId, advertiser.id))
    .orderBy(desc(ads.createdAt));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">{advertiser.name}</h1>
      <div className="mt-2 text-sm text-white/50">
        {t('email_label')}: {advertiser.email}
      </div>
      <div className="text-sm text-white/50">
        {t('joined_label')}: {advertiser.createdAt.toISOString().slice(0, 10)}
      </div>

      <h2 className="mt-8 mb-4 text-lg font-semibold">{t('ads_title')}</h2>

      {advertiserAds.length === 0 ? (
        <p className="text-white/50">{t('no_ads')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {advertiserAds.map((ad) => (
            <div
              key={ad.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <span className="truncate">{ad.title}</span>
              <span className="text-xs text-white/60">{badgeLabel(ad, t)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
