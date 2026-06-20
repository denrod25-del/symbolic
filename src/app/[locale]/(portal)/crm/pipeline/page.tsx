import { currentUser } from '@clerk/nextjs/server';
import { asc, desc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import { crmContacts, crmOpportunities } from '@/models/Schema';
import { PipelineBoard } from './PipelineBoard';

export default async function CrmPipelinePage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CrmPipelinePage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const opportunities = await db
    .select({
      id: crmOpportunities.id,
      title: crmOpportunities.title,
      stage: crmOpportunities.stage,
      value: crmOpportunities.value,
      contactId: crmOpportunities.contactId,
    })
    .from(crmOpportunities)
    .where(eq(crmOpportunities.ownerClerkUserId, user.id))
    .orderBy(desc(crmOpportunities.createdAt));

  const contacts = await db
    .select({ id: crmContacts.id, name: crmContacts.name })
    .from(crmContacts)
    .where(eq(crmContacts.ownerClerkUserId, user.id))
    .orderBy(asc(crmContacts.name));

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>
      <PipelineBoard
        locale={locale}
        opportunities={opportunities}
        contacts={contacts}
      />
    </div>
  );
}
