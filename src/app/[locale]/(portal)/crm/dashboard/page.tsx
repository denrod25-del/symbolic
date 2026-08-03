import { currentUser } from '@clerk/nextjs/server';
import { and, eq, gte, inArray } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import {
  crmAppointments,
  crmContacts,
  crmInvoices,
  crmOpportunities,
  crmQuotes,
} from '@/models/Schema';
import { CRM_OPEN_STAGES } from '@/utils/Crm';

export default async function CrmDashboardPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CrmDashboardPage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

  const contactRows = await db
    .select({ id: crmContacts.id })
    .from(crmContacts)
    .where(eq(crmContacts.ownerClerkUserId, user.id));

  const openRows = await db
    .select({ value: crmOpportunities.value })
    .from(crmOpportunities)
    .where(
      and(
        eq(crmOpportunities.ownerClerkUserId, user.id),
        inArray(crmOpportunities.stage, [...CRM_OPEN_STAGES])
      )
    );

  const upcomingRows = await db
    .select({ id: crmAppointments.id })
    .from(crmAppointments)
    .where(
      and(
        eq(crmAppointments.ownerClerkUserId, user.id),
        eq(crmAppointments.status, 'scheduled'),
        gte(crmAppointments.startAt, new Date())
      )
    );

  const quoteRows = await db
    .select({ id: crmQuotes.id })
    .from(crmQuotes)
    .where(eq(crmQuotes.ownerClerkUserId, user.id));

  const outstandingRows = await db
    .select({ total: crmInvoices.total, amountPaid: crmInvoices.amountPaid })
    .from(crmInvoices)
    .where(
      and(
        eq(crmInvoices.ownerClerkUserId, user.id),
        inArray(crmInvoices.status, ['draft', 'sent'])
      )
    );

  const openCount = openRows.length;
  const pipelineValue = openRows.reduce((sum, row) => sum + row.value, 0);
  const pipelinePounds = (pipelineValue / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });

  const outstanding = outstandingRows.reduce(
    (sum, row) => sum + (row.total - row.amountPaid),
    0
  );
  const outstandingPounds = (outstanding / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">
        {name ? t('greeting', { name }) : t('greeting_anon')}
      </h1>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">{t('contacts_label')}</p>
          <p className="text-3xl font-bold">{contactRows.length}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">{t('open_label')}</p>
          <p className="text-3xl font-bold">{openCount}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">{t('value_label')}</p>
          <p className="text-3xl font-bold">{pipelinePounds}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">{t('quotes_label')}</p>
          <p className="text-3xl font-bold">{quoteRows.length}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">{t('outstanding_label')}</p>
          <p className="text-3xl font-bold">{outstandingPounds}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">{t('upcoming_label')}</p>
          <p className="text-3xl font-bold">{upcomingRows.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${locale}/crm/contacts`}
          className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          {t('manage_contacts')}
        </Link>
        <Link
          href={`/${locale}/crm/pipeline`}
          className="rounded-lg bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          {t('view_pipeline')}
        </Link>
        <Link
          href={`/${locale}/crm/quotes`}
          className="rounded-lg bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          {t('view_quotes')}
        </Link>
        <Link
          href={`/${locale}/crm/invoices`}
          className="rounded-lg bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          {t('view_invoices')}
        </Link>
        <Link
          href={`/${locale}/crm/booking`}
          className="rounded-lg bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          {t('booking_page')}
        </Link>
        <Link
          href={`/${locale}/crm/reports`}
          className="rounded-lg bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          {t('view_reports')}
        </Link>
        <Link
          href={`/${locale}/crm/calendar`}
          className="rounded-lg bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          {t('open_calendar')}
        </Link>
      </div>
    </div>
  );
}
