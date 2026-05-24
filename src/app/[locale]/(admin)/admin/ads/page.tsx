import { count, desc } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { db } from '@/libs/DB';
import { adClicks, ads } from '@/models/Schema';
import { AdminAdActions } from './AdminAdActions';

const FILTERS = ['all', 'pending', 'approved', 'rejected', 'paused'] as const;

type AdsFilter = (typeof FILTERS)[number];

function isAdsFilter(raw: string | undefined): raw is AdsFilter {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return FILTERS.includes(raw as AdsFilter);
}

function parseFilter(raw: string | undefined): AdsFilter {
  return isAdsFilter(raw) ? raw : 'all';
}

export default async function AdminAdsPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const { status } = await props.searchParams;
  const filter = parseFilter(status);
  const t = await getTranslations('AdminAdsPage');

  const allAds = await db.select().from(ads).orderBy(desc(ads.createdAt));

  const clickRows = await db
    .select({ adId: adClicks.adId, value: count() })
    .from(adClicks)
    .groupBy(adClicks.adId);
  const clicksByAd = new Map(clickRows.map((row) => [row.adId, row.value]));

  const filteredAds = allAds.filter((ad) => {
    if (filter === 'all') {
      return true;
    }
    if (filter === 'paused') {
      return ad.status === 'approved' && !ad.active;
    }
    return ad.status === filter;
  });

  function statusLabel(ad: (typeof allAds)[number]): string {
    if (ad.status === 'approved' && !ad.active) {
      return t('status_paused');
    }
    if (ad.status === 'pending') {
      return t('status_pending');
    }
    if (ad.status === 'rejected') {
      return t('status_rejected');
    }
    return t('status_approved');
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-6 flex gap-2">
        {FILTERS.map((value) => (
          <Link
            key={value}
            href={`/${locale}/admin/ads?status=${value}`}
            className={`rounded px-3 py-1 text-xs font-semibold ${
              filter === value
                ? 'bg-indigo-600 text-white'
                : 'border border-white/15 text-white/60 hover:bg-white/5'
            }`}
          >
            {t(`filter_${value}`)}
          </Link>
        ))}
      </div>

      {filteredAds.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 px-6 py-16 text-center text-white/50">
          {t('empty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="grid grid-cols-[2fr_1fr_90px_70px_60px_110px_100px] gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold tracking-wide text-white/40 uppercase">
            <span>{t('col_title')}</span>
            <span>{t('col_advertiser')}</span>
            <span>{t('col_status')}</span>
            <span>{t('col_bid')}</span>
            <span>{t('col_clicks')}</span>
            <span>{t('col_created')}</span>
            <span>{t('col_actions')}</span>
          </div>
          {filteredAds.map((ad) => (
            <div
              key={ad.id}
              className="grid grid-cols-[2fr_1fr_90px_70px_60px_110px_100px] items-center gap-4 border-b border-white/5 px-4 py-3 text-sm last:border-0"
            >
              <span className="truncate">{ad.title}</span>
              <span className="truncate text-white/50">
                {ad.advertiserName}
              </span>
              <span className="text-xs text-white/70">{statusLabel(ad)}</span>
              <span>£{(ad.bidAmount / 100).toFixed(2)}</span>
              <span>{clicksByAd.get(ad.id) ?? 0}</span>
              <span className="text-xs text-white/50">
                {ad.createdAt.toISOString().slice(0, 10)}
              </span>
              <span>
                {ad.status === 'approved' ? (
                  <AdminAdActions
                    adId={ad.id}
                    isActive={ad.active}
                    labels={{
                      suspend: t('suspend'),
                      unsuspend: t('unsuspend'),
                    }}
                  />
                ) : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
