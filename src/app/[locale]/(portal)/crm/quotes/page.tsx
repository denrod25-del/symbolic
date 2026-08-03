import { currentUser } from '@clerk/nextjs/server';
import { desc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import { crmContacts, crmQuotes } from '@/models/Schema';
import { isCrmQuoteStatus } from '@/utils/Crm';
import { QuoteForm } from './QuoteForm';
import { QuoteRowActions } from './QuoteRowActions';

export default async function CrmQuotesPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CrmQuotesPage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const [quotes, contacts] = await Promise.all([
    db
      .select()
      .from(crmQuotes)
      .where(eq(crmQuotes.ownerClerkUserId, user.id))
      .orderBy(desc(crmQuotes.createdAt)),
    db
      .select({ id: crmContacts.id, name: crmContacts.name })
      .from(crmContacts)
      .where(eq(crmContacts.ownerClerkUserId, user.id))
      .orderBy(desc(crmContacts.createdAt)),
  ]);

  const contactNames = new Map(contacts.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-10 rounded-lg border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('add_heading')}
        </h2>
        <QuoteForm locale={locale} contacts={contacts} />
      </div>

      {quotes.length === 0 ? (
        <p className="text-sm text-white/40">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {quotes.map((quote) => {
            const status = isCrmQuoteStatus(quote.status)
              ? quote.status
              : 'draft';
            const total = (quote.total / 100).toLocaleString('en-GB', {
              style: 'currency',
              currency: 'GBP',
            });
            const contactName = quote.contactId
              ? contactNames.get(quote.contactId)
              : null;

            return (
              <li
                key={quote.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium">{quote.title}</p>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                      {t(`status_${status}`)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/50">
                    {total}
                    {' · '}
                    {t('line_count', { count: quote.lineItems.length })}
                    {contactName ? ` · ${contactName}` : ''}
                  </p>
                  {quote.notes ? (
                    <p className="mt-1 text-sm text-white/40">{quote.notes}</p>
                  ) : null}
                </div>
                <QuoteRowActions
                  locale={locale}
                  contacts={contacts}
                  quote={{
                    id: quote.id,
                    title: quote.title,
                    contactId: quote.contactId,
                    notes: quote.notes ?? '',
                    status,
                    lineItems: quote.lineItems,
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
