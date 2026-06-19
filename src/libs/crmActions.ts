'use server';

import { currentUser } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { crmContacts, crmOpportunities } from '@/models/Schema';
import { CRM_STAGES } from '@/utils/Crm';
import { db } from './DB';
import { runWorkflows } from './workflows';

const contactFormSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.union([z.email(), z.literal('')]).default(''),
  phone: z.string().max(40).default(''),
  company: z.string().max(120).default(''),
  notes: z.string().max(2000).default(''),
});

type ContactFormData = z.input<typeof contactFormSchema>;

const opportunityFormSchema = z.object({
  title: z.string().min(1).max(120),
  contactId: z.coerce.number().int().positive().optional(),
  valuePounds: z.coerce.number().min(0).default(0),
});

type OpportunityFormData = z.input<typeof opportunityFormSchema>;

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function revalidateCrm(locale: string) {
  try {
    revalidatePath(`/${locale}/crm/contacts`);
    revalidatePath(`/${locale}/crm/pipeline`);
    revalidatePath(`/${locale}/crm/dashboard`);
  } catch {
    // no-op outside Next.js runtime
  }
}

/**
 * Creates a contact owned by the signed-in user.
 * @param data - Validated contact form fields.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns Success indicator or an error message.
 */
export async function createContact(
  data: ContactFormData,
  locale: string
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const parsed = contactFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { name, email, phone, company, notes } = parsed.data;

  const [created] = await db
    .insert(crmContacts)
    .values({
      ownerClerkUserId: user.id,
      name,
      email: emptyToNull(email),
      phone: emptyToNull(phone),
      company: emptyToNull(company),
      notes: emptyToNull(notes),
    })
    .returning({ id: crmContacts.id });

  if (created) {
    await runWorkflows({
      type: 'contact_created',
      ownerClerkUserId: user.id,
      contactId: created.id,
    });
  }

  revalidateCrm(locale);
  return { success: true };
}

/**
 * Updates a contact. Verifies ownership before updating.
 * @param id - The contact's database ID.
 * @param data - Updated contact form fields.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns Success indicator or an error message.
 */
export async function updateContact(
  id: number,
  data: ContactFormData,
  locale: string
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const parsed = contactFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { name, email, phone, company, notes } = parsed.data;

  const updated = await db
    .update(crmContacts)
    .set({
      name,
      email: emptyToNull(email),
      phone: emptyToNull(phone),
      company: emptyToNull(company),
      notes: emptyToNull(notes),
    })
    .where(
      and(eq(crmContacts.id, id), eq(crmContacts.ownerClerkUserId, user.id))
    )
    .returning({ id: crmContacts.id });

  if (updated.length === 0) {
    return { error: 'Contact not found' };
  }

  revalidateCrm(locale);
  return { success: true };
}

/**
 * Deletes a contact. Verifies ownership before deleting.
 * @param id - The contact's database ID.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns An error message object on failure, or undefined on success.
 */
export async function deleteContact(
  id: number,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  await db
    .delete(crmContacts)
    .where(
      and(eq(crmContacts.id, id), eq(crmContacts.ownerClerkUserId, user.id))
    );

  revalidateCrm(locale);
  return undefined;
}

/**
 * Creates a pipeline opportunity in the `lead` stage for the signed-in user.
 * @param data - Validated opportunity form fields.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns Success indicator or an error message.
 */
export async function createOpportunity(
  data: OpportunityFormData,
  locale: string
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const parsed = opportunityFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { title, contactId, valuePounds } = parsed.data;

  await db.insert(crmOpportunities).values({
    ownerClerkUserId: user.id,
    contactId: contactId ?? null,
    title,
    stage: 'lead',
    value: Math.round(valuePounds * 100),
  });

  revalidateCrm(locale);
  return { success: true };
}

/**
 * Moves an opportunity to a different pipeline stage. Verifies ownership first.
 * @param id - The opportunity's database ID.
 * @param stage - The target pipeline stage.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns An error message object on failure, or undefined on success.
 */
export async function moveOpportunity(
  id: number,
  stage: string,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  if (!(CRM_STAGES as readonly string[]).includes(stage)) {
    return { error: 'Invalid stage' };
  }

  const [moved] = await db
    .update(crmOpportunities)
    .set({ stage })
    .where(
      and(
        eq(crmOpportunities.id, id),
        eq(crmOpportunities.ownerClerkUserId, user.id)
      )
    )
    .returning({ contactId: crmOpportunities.contactId });

  if (moved) {
    await runWorkflows({
      type: 'opportunity_stage_changed',
      ownerClerkUserId: user.id,
      contactId: moved.contactId,
      stage,
    });
  }

  revalidateCrm(locale);
  return undefined;
}

/**
 * Deletes an opportunity. Verifies ownership before deleting.
 * @param id - The opportunity's database ID.
 * @param locale - Current locale used to revalidate CRM paths.
 * @returns An error message object on failure, or undefined on success.
 */
export async function deleteOpportunity(
  id: number,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  await db
    .delete(crmOpportunities)
    .where(
      and(
        eq(crmOpportunities.id, id),
        eq(crmOpportunities.ownerClerkUserId, user.id)
      )
    );

  revalidateCrm(locale);
  return undefined;
}
