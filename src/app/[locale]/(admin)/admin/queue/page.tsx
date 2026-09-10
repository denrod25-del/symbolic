import { asc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@/libs/DB';
import { ads } from '@/models/Schema';
import { formatUsd } from '@/utils/Money';
import { QueueRowActions } from './QueueRowActions';

export default async function AdminQueuePage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('AdminQueuePage');

  const pendingAds = await db
    .select()
    .from(ads)
    .where(eq(ads.status, 'pending'))
    .orderBy(asc(ads.createdAt));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>

      {pendingAds.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 px-6 py-16 text-center text-white/50">
          {t('empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {pendingAds.map((ad) => (
            <div
              key={ad.id}
              className="rounded-lg border border-white/10 bg-white/5 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold">{ad.title}</div>
                  <div className="text-xs text-green-400">{ad.displayUrl}</div>
                  <p className="mt-1 text-sm text-white/60">{ad.description}</p>
                  <div className="mt-2 text-xs text-white/40">{ad.ctaText}</div>
                  <div className="mt-2 text-xs text-white/50">
                    {t('advertiser_label')}: {ad.advertiserName}
                  </div>
                  <div className="text-xs text-white/50">
                    {t('keywords_label')}: {ad.keywords.join(', ')}
                  </div>
                  <div className="text-xs text-white/50">
                    {t('bid_label')}: {formatUsd(ad.bidAmount)}
                  </div>
                </div>
                <QueueRowActions
                  adId={ad.id}
                  labels={{
                    approve: t('approve'),
                    reject: t('reject'),
                    reasonPlaceholder: t('reject_reason_placeholder'),
                    confirm: t('reject_confirm'),
                    cancel: t('reject_cancel'),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
