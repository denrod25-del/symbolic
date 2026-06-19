import { currentUser } from '@clerk/nextjs/server';
import { and, eq, inArray } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import { crmContacts, crmOpportunities } from '@/models/Schema';
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

  const openCount = openRows.length;
  const pipelineValue = openRows.reduce((sum, row) => sum + row.value, 0);
  const pipelinePounds = (pipelineValue / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">
        {name ? t('greeting', { name }) : t('greeting_anon')}
      </h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      </div>

      <div className="flex gap-3">
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
      </div>
    </div>
  );
}
