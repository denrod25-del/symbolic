'use server';

import { currentUser } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { crmAppointments } from '@/models/Schema';
import { CRM_APPOINTMENT_STATUSES } from '@/utils/Crm';
import { db } from './DB';
import { runWorkflows } from './workflows';

const appointmentFormSchema = z.object({
  title: z.string().min(1).max(120),
  contactId: z.coerce.number().int().positive().optional(),
  startAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(5).max(1440).default(30),
  notes: z.string().max(2000).default(''),
});

type AppointmentFormData = z.input<typeof appointmentFormSchema>;

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function revalidateBooking(locale: string) {
  try {
    revalidatePath(`/${locale}/crm/calendar`);
    revalidatePath(`/${locale}/crm/dashboard`);
  } catch {
    // no-op outside Next.js runtime
  }
}

/**
 * Books an appointment for the signed-in user, deriving the end time from the
 * chosen duration.
 * @param data - Validated appointment form fields.
 * @param locale - Current locale used to revalidate booking paths.
 * @returns Success indicator or an error message.
 */
export async function createAppointment(
  data: AppointmentFormData,
  locale: string
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const parsed = appointmentFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { title, contactId, startAt, durationMinutes, notes } = parsed.data;
  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

  await db.insert(crmAppointments).values({
    ownerClerkUserId: user.id,
    contactId: contactId ?? null,
    title,
    startAt,
    endAt,
    status: 'scheduled',
    notes: emptyToNull(notes),
  });

  await runWorkflows({
    type: 'appointment_booked',
    ownerClerkUserId: user.id,
    contactId: contactId ?? null,
  });

  revalidateBooking(locale);
  return { success: true };
}

/**
 * Updates an appointment's details. Verifies ownership before updating.
 * @param id - The appointment's database ID.
 * @param data - Updated appointment form fields.
 * @param locale - Current locale used to revalidate booking paths.
 * @returns Success indicator or an error message.
 */
export async function updateAppointment(
  id: number,
  data: AppointmentFormData,
  locale: string
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const parsed = appointmentFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { title, contactId, startAt, durationMinutes, notes } = parsed.data;
  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

  const updated = await db
    .update(crmAppointments)
    .set({
      title,
      contactId: contactId ?? null,
      startAt,
      endAt,
      notes: emptyToNull(notes),
    })
    .where(
      and(
        eq(crmAppointments.id, id),
        eq(crmAppointments.ownerClerkUserId, user.id)
      )
    )
    .returning({ id: crmAppointments.id });

  if (updated.length === 0) {
    return { error: 'Appointment not found' };
  }

  revalidateBooking(locale);
  return { success: true };
}

/**
 * Sets an appointment's status. Verifies ownership first.
 * @param id - The appointment's database ID.
 * @param status - The target status.
 * @param locale - Current locale used to revalidate booking paths.
 * @returns An error message object on failure, or undefined on success.
 */
export async function setAppointmentStatus(
  id: number,
  status: string,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  if (!(CRM_APPOINTMENT_STATUSES as readonly string[]).includes(status)) {
    return { error: 'Invalid status' };
  }

  await db
    .update(crmAppointments)
    .set({ status })
    .where(
      and(
        eq(crmAppointments.id, id),
        eq(crmAppointments.ownerClerkUserId, user.id)
      )
    );

  revalidateBooking(locale);
  return undefined;
}

/**
 * Deletes an appointment. Verifies ownership before deleting.
 * @param id - The appointment's database ID.
 * @param locale - Current locale used to revalidate booking paths.
 * @returns An error message object on failure, or undefined on success.
 */
export async function deleteAppointment(
  id: number,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  await db
    .delete(crmAppointments)
    .where(
      and(
        eq(crmAppointments.id, id),
        eq(crmAppointments.ownerClerkUserId, user.id)
      )
    );

  revalidateBooking(locale);
  return undefined;
}
