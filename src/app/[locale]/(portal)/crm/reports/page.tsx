import { currentUser } from '@clerk/nextjs/server';
import { and, eq, inArray } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import { crmInvoices, crmOpportunities, crmQuotes } from '@/models/Schema';
import { CRM_OPEN_STAGES, CRM_QUOTE_STATUSES } from '@/utils/Crm';

/**
 * Formats integer pence as a rounded GBP amount.
 * @param pence - The amount in integer minor units.
 * @returns The formatted currency string.
 */
function gbp(pence: number): string {
  return (pence / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
}

export default async function CrmReportsPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CrmReportsPage');
  const tQuote = await getTranslations('CrmQuotesPage');
  const tStage = await getTranslations('CrmPipelinePage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const [invoices, quotes, opportunities] = await Promise.all([
    db
      .select({
        status: crmInvoices.status,
        total: crmInvoices.total,
        amountPaid: crmInvoices.amountPaid,
        cost: crmInvoices.cost,
        updatedAt: crmInvoices.updatedAt,
      })
      .from(crmInvoices)
      .where(eq(crmInvoices.ownerClerkUserId, user.id)),
    db
      .select({ status: crmQuotes.status, total: crmQuotes.total })
      .from(crmQuotes)
      .where(eq(crmQuotes.ownerClerkUserId, user.id)),
    db
      .select({ stage: crmOpportunities.stage, value: crmOpportunities.value })
      .from(crmOpportunities)
      .where(
        and(
          eq(crmOpportunities.ownerClerkUserId, user.id),
          inArray(crmOpportunities.stage, [...CRM_OPEN_STAGES])
        )
      ),
  ]);

  const paidInvoices = invoices.filter((row) => row.status === 'paid');
  const collected = paidInvoices.reduce((sum, row) => sum + row.total, 0);
  const outstanding = invoices
    .filter((row) => row.status === 'draft' || row.status === 'sent')
    .reduce((sum, row) => sum + (row.total - row.amountPaid), 0);
  const invoiced = invoices
    .filter((row) => row.status !== 'void')
    .reduce((sum, row) => sum + row.total, 0);

  const totalCost = paidInvoices.reduce((sum, row) => sum + row.cost, 0);
  const profit = collected - totalCost;
  const margin = collected > 0 ? Math.round((profit / collected) * 100) : null;

  const quoteCounts = CRM_QUOTE_STATUSES.map((status) => ({
    status,
    count: quotes.filter((row) => row.status === status).length,
  }));
  const accepted = quotes.filter((row) => row.status === 'accepted');
  const declinedCount = quotes.filter(
    (row) => row.status === 'declined'
  ).length;
  const decided = accepted.length + declinedCount;
  const winRate =
    decided > 0 ? Math.round((accepted.length / decided) * 100) : null;
  const acceptedValue = accepted.reduce((sum, row) => sum + row.total, 0);

  const pipeline = CRM_OPEN_STAGES.map((stage) => {
    const rows = opportunities.filter((row) => row.stage === stage);
    return {
      stage,
      count: rows.length,
      value: rows.reduce((sum, row) => sum + row.value, 0),
    };
  });

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString(locale, { month: 'short' }),
      total: 0,
    };
  });
  for (const invoice of paidInvoices) {
    const date = invoice.updatedAt;
    const bucket = months.find(
      (month) => month.key === `${date.getFullYear()}-${date.getMonth()}`
    );
    if (bucket) {
      bucket.total += invoice.total;
    }
  }
  const maxMonth = Math.max(1, ...months.map((month) => month.total));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="mb-8 text-sm text-white/50">{t('subtitle')}</p>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('revenue_heading')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <p className="mb-1 text-sm text-white/50">{t('collected')}</p>
            <p className="text-3xl font-bold">{gbp(collected)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <p className="mb-1 text-sm text-white/50">{t('outstanding')}</p>
            <p className="text-3xl font-bold">{gbp(outstanding)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <p className="mb-1 text-sm text-white/50">{t('invoiced')}</p>
            <p className="text-3xl font-bold">{gbp(invoiced)}</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('profit_heading')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <p className="mb-1 text-sm text-white/50">{t('cost')}</p>
            <p className="text-3xl font-bold">{gbp(totalCost)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <p className="mb-1 text-sm text-white/50">{t('profit')}</p>
            <p className="text-3xl font-bold">{gbp(profit)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <p className="mb-1 text-sm text-white/50">{t('margin')}</p>
            <p className="text-3xl font-bold">
              {margin === null ? '—' : `${margin}%`}
            </p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('monthly_heading')}
        </h2>
        <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-6">
          {months.map((month) => (
            <div key={month.key} className="flex items-center gap-3">
              <span className="w-10 text-xs text-white/40">{month.label}</span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-white/5">
                <div
                  className="h-3 rounded bg-indigo-500"
                  style={{ width: `${(month.total / maxMonth) * 100}%` }}
                />
              </div>
              <span className="w-20 text-right text-xs text-white/50">
                {gbp(month.total)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('quotes_heading')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <p className="mb-1 text-sm text-white/50">{t('win_rate')}</p>
            <p className="text-3xl font-bold">
              {winRate === null ? '—' : `${winRate}%`}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <p className="mb-1 text-sm text-white/50">{t('accepted_value')}</p>
            <p className="text-3xl font-bold">{gbp(acceptedValue)}</p>
          </div>
        </div>
        <ul className="mt-4 divide-y divide-white/10 rounded-lg border border-white/10">
          {quoteCounts.map((row) => (
            <li
              key={row.status}
              className="flex items-center justify-between p-3 text-sm"
            >
              <span className="text-white/60">
                {tQuote(`status_${row.status}`)}
              </span>
              <span className="font-medium">{row.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('pipeline_heading')}
        </h2>
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {pipeline.map((row) => (
            <li
              key={row.stage}
              className="flex items-center justify-between p-3 text-sm"
            >
              <span className="text-white/60">
                {tStage(`stage_${row.stage}`)}
              </span>
              <span className="font-medium">
                {row.count}
                {' · '}
                {gbp(row.value)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
