import { currentUser } from '@clerk/nextjs/server';
import { desc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import { crmContacts, crmInvoices } from '@/models/Schema';
import { isCrmInvoiceStatus } from '@/utils/Crm';
import { InvoiceRowActions } from './InvoiceRowActions';

export default async function CrmInvoicesPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CrmInvoicesPage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const [invoices, contacts] = await Promise.all([
    db
      .select()
      .from(crmInvoices)
      .where(eq(crmInvoices.ownerClerkUserId, user.id))
      .orderBy(desc(crmInvoices.createdAt)),
    db
      .select({ id: crmContacts.id, name: crmContacts.name })
      .from(crmContacts)
      .where(eq(crmContacts.ownerClerkUserId, user.id)),
  ]);

  const contactNames = new Map(contacts.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>

      {invoices.length === 0 ? (
        <p className="text-sm text-white/40">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {invoices.map((invoice) => {
            const status = isCrmInvoiceStatus(invoice.status)
              ? invoice.status
              : 'draft';
            const total = (invoice.total / 100).toLocaleString('en-GB', {
              style: 'currency',
              currency: 'GBP',
            });
            const contactName = invoice.contactId
              ? contactNames.get(invoice.contactId)
              : null;
            const due = invoice.dueAt
              ? invoice.dueAt.toLocaleDateString(locale)
              : null;

            return (
              <li
                key={invoice.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium">{invoice.title}</p>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                      {t(`status_${status}`)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/50">
                    {total}
                    {due ? ` · ${t('due', { date: due })}` : ''}
                    {contactName ? ` · ${contactName}` : ''}
                  </p>
                </div>
                <InvoiceRowActions
                  locale={locale}
                  invoice={{ id: invoice.id, status }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
