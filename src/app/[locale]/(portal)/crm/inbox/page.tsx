import { currentUser } from '@clerk/nextjs/server';
import { asc, desc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import { crmContacts, crmMessages } from '@/models/Schema';

export default async function CrmInboxPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CrmInboxPage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const contacts = await db
    .select({ id: crmContacts.id, name: crmContacts.name })
    .from(crmContacts)
    .where(eq(crmContacts.ownerClerkUserId, user.id))
    .orderBy(asc(crmContacts.name));

  const messages = await db
    .select({
      contactId: crmMessages.contactId,
      body: crmMessages.body,
      createdAt: crmMessages.createdAt,
    })
    .from(crmMessages)
    .where(eq(crmMessages.ownerClerkUserId, user.id))
    .orderBy(desc(crmMessages.createdAt));

  const latestByContact = new Map<number, { body: string; createdAt: Date }>();
  for (const message of messages) {
    if (!latestByContact.has(message.contactId)) {
      latestByContact.set(message.contactId, {
        body: message.body,
        createdAt: message.createdAt,
      });
    }
  }

  const threads = contacts
    .map((contact) => ({
      ...contact,
      latest: latestByContact.get(contact.id) ?? null,
    }))
    .toSorted((a, b) => {
      const aTime = a.latest?.createdAt.getTime() ?? 0;
      const bTime = b.latest?.createdAt.getTime() ?? 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>

      {contacts.length === 0 ? (
        <p className="text-sm text-white/40">
          {t('no_contacts')}{' '}
          <Link
            href={`/${locale}/crm/contacts`}
            className="text-indigo-400 hover:underline"
          >
            {t('add_contacts_link')}
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`/${locale}/crm/inbox/${thread.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="font-medium">{thread.name}</p>
                  <p className="truncate text-sm text-white/40">
                    {thread.latest?.body ?? t('no_messages')}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-white/30">
                  {thread.latest
                    ? thread.latest.createdAt.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
