import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { listTransactions } from '@/libs/billing';
import { db } from '@/libs/DB';
import { advertisers } from '@/models/Schema';
import { formatUsd } from '@/utils/Money';
import { TopUpButtons } from './TopUpButtons';

const LOW_BALANCE_CENTS = 500;
const HISTORY_LIMIT = 50;

function balanceClass(balanceCents: number): string {
  if (balanceCents <= 0) {
    return 'text-red-400';
  }
  if (balanceCents < LOW_BALANCE_CENTS) {
    return 'text-amber-400';
  }
  return 'text-white';
}

export default async function BillingPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ topup?: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const { topup } = await props.searchParams;
  const t = await getTranslations('BillingPage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const [advertiser] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, user.id))
    .limit(1);

  if (!advertiser) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const transactions = await listTransactions(advertiser.id, HISTORY_LIMIT);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>

      {topup === 'pending' && (
        <div className="mb-6 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {t('topup_pending')}{' '}
          <a className="underline" href={`/${locale}/advertise/billing`}>
            {t('refresh')}
          </a>
        </div>
      )}
      {topup === 'simulated' && (
        <div className="mb-6 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/60">
          {t('topup_simulated')}
        </div>
      )}

      <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-6">
        <div className="text-xs tracking-wide text-white/40 uppercase">
          {t('balance_label')}
        </div>
        <div
          className={`mt-1 text-4xl font-bold ${balanceClass(advertiser.balanceCents)}`}
        >
          {formatUsd(advertiser.balanceCents)}
        </div>
        {advertiser.balanceCents <= 0 && (
          <p className="mt-2 text-sm text-red-400">{t('no_funds')}</p>
        )}
        {advertiser.balanceCents > 0 &&
          advertiser.balanceCents < LOW_BALANCE_CENTS && (
            <p className="mt-2 text-sm text-amber-400">{t('low_balance')}</p>
          )}
      </div>

      <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 font-medium">{t('topup_title')}</h2>
        <TopUpButtons
          labels={{
            custom: t('topup_custom_placeholder'),
            submit: t('topup_button'),
            errors: {
              not_signed_in: t('error_not_signed_in'),
              invalid_amount: t('error_invalid_amount'),
              no_account: t('error_no_account'),
              checkout_failed: t('error_checkout_failed'),
            },
          }}
        />
      </div>

      <h2 className="mb-4 font-medium">{t('history_title')}</h2>
      {transactions.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-white/5 px-6 py-12 text-center text-white/50">
          {t('history_empty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="grid grid-cols-[110px_1fr_100px_100px] gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold tracking-wide text-white/40 uppercase">
            <span>{t('col_date')}</span>
            <span>{t('col_description')}</span>
            <span>{t('col_amount')}</span>
            <span>{t('col_balance')}</span>
          </div>
          {transactions.map((row) => (
            <div
              className="grid grid-cols-[110px_1fr_100px_100px] items-center gap-4 border-b border-white/5 px-4 py-3 text-sm last:border-0"
              key={row.id}
            >
              <span className="text-xs text-white/50">
                {row.createdAt.toISOString().slice(0, 10)}
              </span>
              <span className="truncate">{row.description}</span>
              <span
                className={
                  row.amountCents >= 0 ? 'text-green-400' : 'text-red-400'
                }
              >
                {row.amountCents >= 0 ? '+' : ''}
                {formatUsd(row.amountCents)}
              </span>
              <span className="text-white/60">
                {formatUsd(row.balanceAfterCents)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
