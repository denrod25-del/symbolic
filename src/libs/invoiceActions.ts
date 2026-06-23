'use server';

import { currentUser } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { crmInvoices, crmQuotes } from '@/models/Schema';
import { isCrmInvoiceStatus } from '@/utils/Crm';
import { db } from './DB';
import { createPaymentLink } from './payments';
import { runWorkflows } from './workflows';

/** Days until a freshly converted invoice is due. */
const INVOICE_DUE_DAYS = 14;

function revalidateInvoices(locale: string) {
  try {
    revalidatePath(`/${locale}/crm/invoices`);
    revalidatePath(`/${locale}/crm/quotes`);
    revalidatePath(`/${locale}/crm/dashboard`);
  } catch {
    // no-op outside Next.js runtime
  }
}

/**
 * Converts an accepted quote into a draft invoice owned by the same user.
 * @param quoteId - The accepted quote to convert.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns Success indicator or an error message.
 */
export async function convertQuoteToInvoice(
  quoteId: number,
  locale: string
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const [quote] = await db
    .select()
    .from(crmQuotes)
    .where(
      and(eq(crmQuotes.id, quoteId), eq(crmQuotes.ownerClerkUserId, user.id))
    )
    .limit(1);

  if (!quote) {
    return { error: 'Quote not found' };
  }

  if (quote.status !== 'accepted') {
    return { error: 'Only accepted quotes can be invoiced' };
  }

  const [existing] = await db
    .select({ id: crmInvoices.id })
    .from(crmInvoices)
    .where(
      and(
        eq(crmInvoices.quoteId, quote.id),
        eq(crmInvoices.ownerClerkUserId, user.id)
      )
    )
    .limit(1);

  if (existing) {
    return { success: true };
  }

  const dueAt = new Date(Date.now() + INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(crmInvoices).values({
    ownerClerkUserId: user.id,
    quoteId: quote.id,
    contactId: quote.contactId,
    title: quote.title,
    status: 'draft',
    lineItems: quote.lineItems,
    total: quote.total,
    dueAt,
    notes: quote.notes,
  });

  revalidateInvoices(locale);
  return { success: true };
}

/**
 * Moves an invoice to a different status, settling the balance when paid.
 * @param id - The invoice's database ID.
 * @param status - The target invoice status.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns An error message object on failure, or undefined on success.
 */
export async function setInvoiceStatus(
  id: number,
  status: string,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  if (!isCrmInvoiceStatus(status)) {
    return { error: 'Invalid status' };
  }

  const [invoice] = await db
    .select({ total: crmInvoices.total, contactId: crmInvoices.contactId })
    .from(crmInvoices)
    .where(
      and(eq(crmInvoices.id, id), eq(crmInvoices.ownerClerkUserId, user.id))
    )
    .limit(1);

  if (!invoice) {
    return { error: 'Invoice not found' };
  }

  await db
    .update(crmInvoices)
    .set({
      status,
      amountPaid: status === 'paid' ? invoice.total : 0,
    })
    .where(
      and(eq(crmInvoices.id, id), eq(crmInvoices.ownerClerkUserId, user.id))
    );

  if (status === 'paid') {
    await runWorkflows({
      type: 'invoice_paid',
      ownerClerkUserId: user.id,
      contactId: invoice.contactId,
    });
  }

  revalidateInvoices(locale);
  return undefined;
}

/**
 * Creates a hosted payment link for an invoice and marks it as sent. Uses
 * Stripe when configured, otherwise a simulated link.
 * @param id - The invoice's database ID.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns Success indicator or an error message.
 */
export async function createInvoicePaymentLink(
  id: number,
  locale: string
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const [invoice] = await db
    .select()
    .from(crmInvoices)
    .where(
      and(eq(crmInvoices.id, id), eq(crmInvoices.ownerClerkUserId, user.id))
    )
    .limit(1);

  if (!invoice) {
    return { error: 'Invoice not found' };
  }

  if (invoice.status === 'paid' || invoice.status === 'void') {
    return { error: 'Invoice is already settled' };
  }

  const result = await createPaymentLink({
    invoiceId: invoice.id,
    title: invoice.title,
    currency: 'gbp',
    lineItems: invoice.lineItems,
  });

  if (result.status === 'failed') {
    return { error: 'Could not create payment link' };
  }

  await db
    .update(crmInvoices)
    .set({
      status: 'sent',
      paymentUrl: result.url,
      paymentRef: result.providerId,
    })
    .where(
      and(eq(crmInvoices.id, id), eq(crmInvoices.ownerClerkUserId, user.id))
    );

  revalidateInvoices(locale);
  return { success: true };
}

/**
 * Deletes an invoice. Verifies ownership before deleting.
 * @param id - The invoice's database ID.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns An error message object on failure, or undefined on success.
 */
export async function deleteInvoice(
  id: number,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  await db
    .delete(crmInvoices)
    .where(
      and(eq(crmInvoices.id, id), eq(crmInvoices.ownerClerkUserId, user.id))
    );

  revalidateInvoices(locale);
  return undefined;
}
