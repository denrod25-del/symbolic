import { currentUser } from '@clerk/nextjs/server';
import { desc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import { crmContacts } from '@/models/Schema';
import { ContactForm } from './ContactForm';
import { ContactRowActions } from './ContactRowActions';

export default async function CrmContactsPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CrmContactsPage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const contacts = await db
    .select()
    .from(crmContacts)
    .where(eq(crmContacts.ownerClerkUserId, user.id))
    .orderBy(desc(crmContacts.createdAt));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-10 rounded-lg border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('add_heading')}
        </h2>
        <ContactForm locale={locale} />
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-white/40">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex items-start justify-between gap-4 p-4"
            >
              <div>
                <p className="font-medium">{contact.name}</p>
                <p className="text-sm text-white/50">
                  {[contact.company, contact.email, contact.phone]
                    .filter(Boolean)
                    .join(' · ') || t('no_details')}
                </p>
                {contact.notes ? (
                  <p className="mt-1 text-sm text-white/40">{contact.notes}</p>
                ) : null}
              </div>
              <ContactRowActions
                locale={locale}
                contact={{
                  id: contact.id,
                  name: contact.name,
                  email: contact.email ?? '',
                  phone: contact.phone ?? '',
                  company: contact.company ?? '',
                  notes: contact.notes ?? '',
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
