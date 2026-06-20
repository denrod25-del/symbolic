import { currentUser } from '@clerk/nextjs/server';
import { and, asc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import { crmContacts, crmMessages } from '@/models/Schema';
import { isCrmMessageChannel, isCrmMessageStatus } from '@/utils/Crm';
import { Composer } from './Composer';

export default async function CrmThreadPage(props: {
  params: Promise<{ locale: string; contactId: string }>;
}) {
  const { locale, contactId } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CrmThreadPage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const id = Number(contactId);
  if (!Number.isInteger(id) || id <= 0) {
    redirect(`/${locale}/crm/inbox`);
  }

  const [contact] = await db
    .select()
    .from(crmContacts)
    .where(
      and(eq(crmContacts.id, id), eq(crmContacts.ownerClerkUserId, user.id))
    )
    .limit(1);

  if (!contact) {
    redirect(`/${locale}/crm/inbox`);
  }

  const messages = await db
    .select({
      id: crmMessages.id,
      channel: crmMessages.channel,
      direction: crmMessages.direction,
      subject: crmMessages.subject,
      body: crmMessages.body,
      status: crmMessages.status,
      createdAt: crmMessages.createdAt,
    })
    .from(crmMessages)
    .where(
      and(
        eq(crmMessages.contactId, id),
        eq(crmMessages.ownerClerkUserId, user.id)
      )
    )
    .orderBy(asc(crmMessages.createdAt));

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/${locale}/crm/inbox`}
        className="mb-6 inline-block text-sm text-white/50 hover:text-white"
      >
        {t('back')}
      </Link>
      <h1 className="text-2xl font-bold">{contact.name}</h1>
      <p className="mb-8 text-sm text-white/40">
        {[contact.email, contact.phone].filter(Boolean).join(' · ') ||
          t('no_details')}
      </p>

      <div className="mb-8 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-white/40">{t('empty')}</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={
                message.direction === 'outbound'
                  ? 'ml-auto max-w-[80%] rounded-lg bg-indigo-600 p-3'
                  : 'mr-auto max-w-[80%] rounded-lg bg-white/10 p-3'
              }
            >
              {message.subject ? (
                <p className="mb-1 text-xs font-semibold text-white/70">
                  {message.subject}
                </p>
              ) : null}
              <p className="text-sm whitespace-pre-wrap">{message.body}</p>
              <p className="mt-1 text-xs text-white/40">
                {isCrmMessageChannel(message.channel)
                  ? t(`channel_${message.channel}`)
                  : message.channel}
                {' · '}
                {isCrmMessageStatus(message.status)
                  ? t(`status_${message.status}`)
                  : message.status}
              </p>
            </div>
          ))
        )}
      </div>

      <Composer
        contactId={id}
        hasEmail={Boolean(contact.email)}
        hasPhone={Boolean(contact.phone)}
        locale={locale}
      />
    </div>
  );
}
