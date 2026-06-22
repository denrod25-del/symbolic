'use server';

import { currentUser } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { crmContacts, crmQuotes } from '@/models/Schema';
import type { CrmQuoteLineItem } from '@/utils/Crm';
import { isCrmQuoteStatus, quoteLineItemsTotal } from '@/utils/Crm';
import { db } from './DB';

const lineItemSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.coerce.number().min(0).max(100_000),
  unitPricePounds: z.coerce.number().min(0).max(1_000_000),
});

const quoteFormSchema = z.object({
  title: z.string().min(1).max(120),
  contactId: z.coerce.number().int().positive().optional(),
  notes: z.string().max(2000).default(''),
  lineItems: z.array(lineItemSchema).min(1).max(100),
});

type QuoteFormData = z.input<typeof quoteFormSchema>;

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function revalidateQuotes(locale: string) {
  try {
    revalidatePath(`/${locale}/crm/quotes`);
    revalidatePath(`/${locale}/crm/dashboard`);
  } catch {
    // no-op outside Next.js runtime
  }
}

/**
 * Converts validated line items into stored line items priced in pence.
 * @param items - Line items from the quote form, priced in pounds.
 * @returns Line items with unit prices in integer minor units.
 */
function toStoredLineItems(
  items: z.output<typeof quoteFormSchema>['lineItems']
): CrmQuoteLineItem[] {
  return items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: Math.round(item.unitPricePounds * 100),
  }));
}

/**
 * Checks whether a contact belongs to the given user.
 * @param userId - The signed-in user's Clerk ID.
 * @param contactId - The contact to verify ownership of.
 * @returns Whether the contact exists and is owned by the user.
 */
async function ownsContact(
  userId: string,
  contactId: number
): Promise<boolean> {
  const [row] = await db
    .select({ id: crmContacts.id })
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.id, contactId),
        eq(crmContacts.ownerClerkUserId, userId)
      )
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Creates a draft quote owned by the signed-in user.
 * @param data - Validated quote form fields.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns Success indicator or an error message.
 */
export async function createQuote(
  data: QuoteFormData,
  locale: string
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const parsed = quoteFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { title, contactId, notes } = parsed.data;

  if (contactId !== undefined && !(await ownsContact(user.id, contactId))) {
    return { error: 'Contact not found' };
  }

  const lineItems = toStoredLineItems(parsed.data.lineItems);

  await db.insert(crmQuotes).values({
    ownerClerkUserId: user.id,
    contactId: contactId ?? null,
    title,
    status: 'draft',
    lineItems,
    total: quoteLineItemsTotal(lineItems),
    notes: emptyToNull(notes),
  });

  revalidateQuotes(locale);
  return { success: true };
}

/**
 * Updates a quote. Verifies ownership before updating.
 * @param id - The quote's database ID.
 * @param data - Updated quote form fields.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns Success indicator or an error message.
 */
export async function updateQuote(
  id: number,
  data: QuoteFormData,
  locale: string
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const parsed = quoteFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { title, contactId, notes } = parsed.data;

  if (contactId !== undefined && !(await ownsContact(user.id, contactId))) {
    return { error: 'Contact not found' };
  }

  const lineItems = toStoredLineItems(parsed.data.lineItems);

  const updated = await db
    .update(crmQuotes)
    .set({
      contactId: contactId ?? null,
      title,
      lineItems,
      total: quoteLineItemsTotal(lineItems),
      notes: emptyToNull(notes),
    })
    .where(and(eq(crmQuotes.id, id), eq(crmQuotes.ownerClerkUserId, user.id)))
    .returning({ id: crmQuotes.id });

  if (updated.length === 0) {
    return { error: 'Quote not found' };
  }

  revalidateQuotes(locale);
  return { success: true };
}

/**
 * Moves a quote to a different status. Verifies ownership first.
 * @param id - The quote's database ID.
 * @param status - The target quote status.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns An error message object on failure, or undefined on success.
 */
export async function setQuoteStatus(
  id: number,
  status: string,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  if (!isCrmQuoteStatus(status)) {
    return { error: 'Invalid status' };
  }

  const updated = await db
    .update(crmQuotes)
    .set({ status })
    .where(and(eq(crmQuotes.id, id), eq(crmQuotes.ownerClerkUserId, user.id)))
    .returning({ id: crmQuotes.id });

  if (updated.length === 0) {
    return { error: 'Quote not found' };
  }

  revalidateQuotes(locale);
  return undefined;
}

/**
 * Deletes a quote. Verifies ownership before deleting.
 * @param id - The quote's database ID.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns An error message object on failure, or undefined on success.
 */
export async function deleteQuote(
  id: number,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  await db
    .delete(crmQuotes)
    .where(and(eq(crmQuotes.id, id), eq(crmQuotes.ownerClerkUserId, user.id)));

  revalidateQuotes(locale);
  return undefined;
}
