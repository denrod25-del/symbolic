import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { getAdminStats } from '@/libs/adminStats';

export default async function AdminDashboardPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('AdminDashboardPage');

  const stats = await getAdminStats();
  const revenuePounds = (stats.revenuePenceLast30Days / 100).toFixed(2);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>

      {stats.pendingAds > 0 && (
        <Link
          href={`/${locale}/admin/queue`}
          className="mb-8 block rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm font-semibold text-yellow-300 hover:bg-yellow-500/20"
        >
          {t('queue_banner', { count: stats.pendingAds })}
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
          <div className="text-xs tracking-wide text-white/40 uppercase">
            {t('stat_advertisers')}
          </div>
          <div className="mt-1 text-3xl font-bold">{stats.advertiserCount}</div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
          <div className="text-xs tracking-wide text-white/40 uppercase">
            {t('stat_total_ads')}
          </div>
          <div className="mt-1 text-3xl font-bold">{stats.totalAds}</div>
          <div className="mt-1 text-xs text-white/50">
            {t('stat_breakdown', {
              pending: stats.pendingAds,
              approved: stats.approvedAds,
              rejected: stats.rejectedAds,
            })}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
          <div className="text-xs tracking-wide text-white/40 uppercase">
            {t('stat_clicks')}
          </div>
          <div className="mt-1 text-3xl font-bold">
            {stats.clicksLast30Days}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
          <div className="text-xs tracking-wide text-white/40 uppercase">
            {t('stat_revenue')}
          </div>
          <div className="mt-1 text-3xl font-bold">£{revenuePounds}</div>
        </div>
      </div>
    </div>
  );
}
