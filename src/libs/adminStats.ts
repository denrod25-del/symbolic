import { count, eq, gte, sql } from 'drizzle-orm';
import { adClicks, ads, advertisers } from '@/models/Schema';
import { db } from './DB';

export type AdminStats = {
  advertiserCount: number;
  totalAds: number;
  pendingAds: number;
  approvedAds: number;
  rejectedAds: number;
  clicksLast30Days: number;
  revenuePenceLast30Days: number;
};

/**
 * Returns the timestamp 30 days before now.
 * @returns Date 30 days in the past.
 */
function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

/**
 * Collects platform-wide stats for the admin dashboard.
 * @returns The aggregated admin stats.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const since = thirtyDaysAgo();

  const [[advertiserRow], statusRows, [clicksRow], [revenueRow]] =
    await Promise.all([
      db.select({ value: count() }).from(advertisers),
      db
        .select({ status: ads.status, value: count() })
        .from(ads)
        .groupBy(ads.status),
      db
        .select({ value: count() })
        .from(adClicks)
        .where(gte(adClicks.clickedAt, since)),
      db
        .select({
          value: sql<number>`coalesce(sum(${ads.bidAmount}), 0)`.mapWith(
            Number
          ),
        })
        .from(adClicks)
        .innerJoin(ads, eq(adClicks.adId, ads.id))
        .where(gte(adClicks.clickedAt, since)),
    ]);

  const byStatus = (target: string) =>
    statusRows.find((row) => row.status === target)?.value ?? 0;

  const pendingAds = byStatus('pending');
  const approvedAds = byStatus('approved');
  const rejectedAds = byStatus('rejected');

  return {
    advertiserCount: advertiserRow?.value ?? 0,
    totalAds: pendingAds + approvedAds + rejectedAds,
    pendingAds,
    approvedAds,
    rejectedAds,
    clicksLast30Days: clicksRow?.value ?? 0,
    revenuePenceLast30Days: revenueRow?.value ?? 0,
  };
}
