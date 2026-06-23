'use server';

import { currentUser } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { crmContacts, crmMessages } from '@/models/Schema';
import { CRM_MESSAGE_CHANNELS } from '@/utils/Crm';
import { db } from './DB';
import { dispatchMessage } from './messaging';
import { draftReply } from './replyAssistant';

const messageFormSchema = z.object({
  contactId: z.coerce.number().int().positive(),
  channel: z.enum(CRM_MESSAGE_CHANNELS),
  subject: z.string().max(200).default(''),
  body: z.string().min(1).max(4000),
});

type MessageFormData = z.input<typeof messageFormSchema>;

/**
 * Sends an outbound message to a contact and records it in the conversation
 * thread. Verifies the contact belongs to the signed-in user and has the
 * address required for the chosen channel.
 * @param data - Validated message form fields.
 * @param locale - Current locale used to revalidate inbox paths.
 * @returns Success indicator or an error message.
 */
export async function sendMessage(
  data: MessageFormData,
  locale: string
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const parsed = messageFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { contactId, channel, subject, body } = parsed.data;

  const [contact] = await db
    .select()
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.id, contactId),
        eq(crmContacts.ownerClerkUserId, user.id)
      )
    )
    .limit(1);

  if (!contact) {
    return { error: 'Contact not found' };
  }

  const to = channel === 'email' ? contact.email : contact.phone;
  if (!to) {
    return {
      error:
        channel === 'email' ? 'Contact has no email' : 'Contact has no phone',
    };
  }

  const trimmedSubject = subject.trim();
  const result = await dispatchMessage({
    channel,
    to,
    subject: channel === 'email' && trimmedSubject ? trimmedSubject : null,
    body,
  });

  await db.insert(crmMessages).values({
    ownerClerkUserId: user.id,
    contactId,
    channel,
    direction: 'outbound',
    subject: channel === 'email' && trimmedSubject ? trimmedSubject : null,
    body,
    status: result.status,
    providerId: result.providerId,
  });

  try {
    revalidatePath(`/${locale}/crm/inbox`);
    revalidatePath(`/${locale}/crm/inbox/${contactId}`);
  } catch {
    // no-op outside Next.js runtime
  }

  if (result.status === 'failed') {
    return { error: 'Message could not be delivered' };
  }

  return { success: true };
}

/**
 * Drafts a reply to a contact's conversation using the AI assistant. Verifies
 * the contact belongs to the signed-in user.
 * @param contactId - The contact whose thread is drafted against.
 * @returns The drafted reply text, or an error message.
 */
export async function suggestReply(
  contactId: number
): Promise<{ success: true; draft: string } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const [contact] = await db
    .select({ name: crmContacts.name })
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.id, contactId),
        eq(crmContacts.ownerClerkUserId, user.id)
      )
    )
    .limit(1);

  if (!contact) {
    return { error: 'Contact not found' };
  }

  const recent = await db
    .select({ direction: crmMessages.direction, body: crmMessages.body })
    .from(crmMessages)
    .where(
      and(
        eq(crmMessages.contactId, contactId),
        eq(crmMessages.ownerClerkUserId, user.id)
      )
    )
    .orderBy(desc(crmMessages.createdAt))
    .limit(12);

  if (recent.length === 0) {
    return { error: 'No conversation to reply to' };
  }

  const result = await draftReply({
    contactName: contact.name,
    messages: recent.toReversed(),
  });

  if (result.status === 'failed') {
    return { error: 'Could not draft a reply' };
  }

  return { success: true, draft: result.text };
}
