'use server';

import { randomUUID } from 'node:crypto';
import { currentUser } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import {
  crmAppointments,
  crmBookingSettings,
  crmContacts,
} from '@/models/Schema';
import { db } from './DB';
import { runWorkflows } from './workflows';

export type BookingSettings = {
  slug: string;
  businessName: string;
  enabled: boolean;
  defaultDurationMinutes: number;
};

const bookingSettingsSchema = z.object({
  businessName: z.string().max(120).default(''),
  enabled: z.boolean().default(true),
  defaultDurationMinutes: z.coerce.number().int().min(5).max(1440).default(60),
});

type BookingSettingsData = z.input<typeof bookingSettingsSchema>;

const requestBookingSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.union([z.email(), z.literal('')]).default(''),
  phone: z.string().max(40).default(''),
  startAt: z.coerce.date(),
  notes: z.string().max(2000).default(''),
});

type RequestBookingData = z.input<typeof requestBookingSchema>;

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Returns the signed-in user's booking settings, creating them on first use.
 * @returns The owner's booking settings, or null when not authenticated.
 */
export async function ensureBookingSettings(): Promise<BookingSettings | null> {
  const user = await currentUser();
  if (!user) {
    return null;
  }

  const [existing] = await db
    .select()
    .from(crmBookingSettings)
    .where(eq(crmBookingSettings.ownerClerkUserId, user.id))
    .limit(1);

  let row = existing;
  if (!row) {
    const [inserted] = await db
      .insert(crmBookingSettings)
      .values({ ownerClerkUserId: user.id, slug: randomUUID() })
      .returning();
    row = inserted;
  }

  if (!row) {
    return null;
  }

  return {
    slug: row.slug,
    businessName: row.businessName ?? '',
    enabled: row.enabled,
    defaultDurationMinutes: row.defaultDurationMinutes,
  };
}

/**
 * Updates the signed-in user's booking settings.
 * @param data - Validated booking settings fields.
 * @param locale - Current locale used to revalidate the booking page.
 * @returns Success indicator or an error message.
 */
export async function updateBookingSettings(
  data: BookingSettingsData,
  locale: string
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const parsed = bookingSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { businessName, enabled, defaultDurationMinutes } = parsed.data;

  await db
    .update(crmBookingSettings)
    .set({
      businessName: emptyToNull(businessName),
      enabled,
      defaultDurationMinutes,
    })
    .where(eq(crmBookingSettings.ownerClerkUserId, user.id));

  try {
    revalidatePath(`/${locale}/crm/booking`);
  } catch {
    // no-op outside Next.js runtime
  }
  return { success: true };
}

/**
 * Finds the contact matching an email for an owner, or creates a new one.
 * @param ownerClerkUserId - The owner the contact belongs to.
 * @param fields - The booker's details.
 * @returns The contact id and whether it was newly created.
 */
async function findOrCreateContact(
  ownerClerkUserId: string,
  fields: { name: string; email: string | null; phone: string | null }
): Promise<{ id: number; created: boolean } | null> {
  if (fields.email) {
    const [match] = await db
      .select({ id: crmContacts.id })
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.ownerClerkUserId, ownerClerkUserId),
          eq(crmContacts.email, fields.email)
        )
      )
      .limit(1);
    if (match) {
      return { id: match.id, created: false };
    }
  }

  const [created] = await db
    .insert(crmContacts)
    .values({
      ownerClerkUserId,
      name: fields.name,
      email: fields.email,
      phone: fields.phone,
    })
    .returning({ id: crmContacts.id });

  return created ? { id: created.id, created: true } : null;
}

/**
 * Books an appointment from the public booking page. Identifies the owner by
 * slug; no authentication required.
 * @param slug - The owner's public booking slug.
 * @param data - The booker's details and requested time.
 * @returns Success indicator or an error message.
 */
export async function requestBooking(
  slug: string,
  data: RequestBookingData
): Promise<{ success: true } | { error: string }> {
  const [settings] = await db
    .select()
    .from(crmBookingSettings)
    .where(eq(crmBookingSettings.slug, slug))
    .limit(1);

  if (!settings || !settings.enabled) {
    return { error: 'Booking is not available' };
  }

  const parsed = requestBookingSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { name, email, phone, startAt, notes } = parsed.data;
  if (startAt.getTime() <= Date.now()) {
    return { error: 'Choose a time in the future' };
  }

  const ownerId = settings.ownerClerkUserId;
  const contact = await findOrCreateContact(ownerId, {
    name,
    email: emptyToNull(email),
    phone: emptyToNull(phone),
  });

  if (!contact) {
    return { error: 'Could not create the booking' };
  }

  if (contact.created) {
    await runWorkflows({
      type: 'contact_created',
      ownerClerkUserId: ownerId,
      contactId: contact.id,
    });
  }

  const endAt = new Date(
    startAt.getTime() + settings.defaultDurationMinutes * 60_000
  );

  await db.insert(crmAppointments).values({
    ownerClerkUserId: ownerId,
    contactId: contact.id,
    title: `Online booking — ${name}`,
    startAt,
    endAt,
    status: 'scheduled',
    notes: emptyToNull(notes),
  });

  await runWorkflows({
    type: 'appointment_booked',
    ownerClerkUserId: ownerId,
    contactId: contact.id,
  });

  return { success: true };
}
