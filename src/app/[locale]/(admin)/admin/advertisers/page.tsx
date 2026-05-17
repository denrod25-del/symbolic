import { count, desc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { db } from '@/libs/DB';
import { adClicks, ads, advertisers } from '@/models/Schema';

export default async function AdminAdvertisersPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('AdminAdvertisersPage');

  const allAdvertisers = await db
    .select()
    .from(advertisers)
    .orderBy(desc(advertisers.createdAt));

  const adCountRows = await db
    .select({ advertiserId: ads.advertiserId, value: count() })
    .from(ads)
    .groupBy(ads.advertiserId);
  const adsByAdvertiser = new Map(
    adCountRows.map((row) => [row.advertiserId, row.value])
  );

  const clickCountRows = await db
    .select({ advertiserId: ads.advertiserId, value: count() })
    .from(adClicks)
    .innerJoin(ads, eq(adClicks.adId, ads.id))
    .groupBy(ads.advertiserId);
  const clicksByAdvertiser = new Map(
    clickCountRows.map((row) => [row.advertiserId, row.value])
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      {allAdvertisers.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 px-6 py-16 text-center text-white/50">
          {t('empty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="grid grid-cols-[1.5fr_2fr_60px_70px_110px_80px] gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold tracking-wide text-white/40 uppercase">
            <span>{t('col_name')}</span>
            <span>{t('col_email')}</span>
            <span>{t('col_ads')}</span>
            <span>{t('col_clicks')}</span>
            <span>{t('col_joined')}</span>
            <span />
          </div>
          {allAdvertisers.map((advertiser) => (
            <div
              key={advertiser.id}
              className="grid grid-cols-[1.5fr_2fr_60px_70px_110px_80px] items-center gap-4 border-b border-white/5 px-4 py-3 text-sm last:border-0"
            >
              <span className="truncate">{advertiser.name}</span>
              <span className="truncate text-white/50">{advertiser.email}</span>
              <span>{adsByAdvertiser.get(advertiser.id) ?? 0}</span>
              <span>{clicksByAdvertiser.get(advertiser.id) ?? 0}</span>
              <span className="text-xs text-white/50">
                {advertiser.createdAt.toISOString().slice(0, 10)}
              </span>
              <Link
                href={`/${locale}/admin/advertisers/${advertiser.id}`}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
              >
                {t('view')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
