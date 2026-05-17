'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { ads } from '@/models/Schema';
import { getAdminUser } from './admin';
import { db } from './DB';

const rejectReasonSchema = z.string().min(1).max(300);

/**
 * Revalidates the admin queue and ads list pages, ignoring errors thrown
 * outside the Next.js runtime (e.g. during tests).
 */
function revalidateAdminPaths() {
  try {
    revalidatePath('/admin/queue');
    revalidatePath('/admin/ads');
  } catch {
    // no-op outside Next.js runtime
  }
}

/**
 * Approves a pending ad. Admin only.
 * @param id - The ad's database ID.
 * @returns An error object when refused, otherwise undefined.
 */
export async function approveAd(
  id: number
): Promise<{ error: string } | undefined> {
  const admin = await getAdminUser();
  if (!admin) {
    return { error: 'Not authorized' };
  }

  await db
    .update(ads)
    .set({ status: 'approved', reviewedAt: new Date(), reviewedBy: admin.id })
    .where(eq(ads.id, id));

  revalidateAdminPaths();
  return undefined;
}

/**
 * Rejects an ad with a reason. Admin only.
 * @param id - The ad's database ID.
 * @param reason - The rejection reason shown to the advertiser.
 * @returns An error object when refused, otherwise undefined.
 */
export async function rejectAd(
  id: number,
  reason: string
): Promise<{ error: string } | undefined> {
  const admin = await getAdminUser();
  if (!admin) {
    return { error: 'Not authorized' };
  }

  const parsed = rejectReasonSchema.safeParse(reason);
  if (!parsed.success) {
    return { error: 'A rejection reason of 1-300 characters is required' };
  }

  await db
    .update(ads)
    .set({
      status: 'rejected',
      rejectionReason: parsed.data,
      reviewedAt: new Date(),
      reviewedBy: admin.id,
    })
    .where(eq(ads.id, id));

  revalidateAdminPaths();
  return undefined;
}

/**
 * Suspends an ad by clearing its active flag. Admin only.
 * @param id - The ad's database ID.
 * @returns An error object when refused, otherwise undefined.
 */
export async function suspendAd(
  id: number
): Promise<{ error: string } | undefined> {
  const admin = await getAdminUser();
  if (!admin) {
    return { error: 'Not authorized' };
  }

  await db.update(ads).set({ active: false }).where(eq(ads.id, id));

  revalidateAdminPaths();
  return undefined;
}

/**
 * Unsuspends an ad by setting its active flag. Admin only.
 * @param id - The ad's database ID.
 * @returns An error object when refused, otherwise undefined.
 */
export async function unsuspendAd(
  id: number
): Promise<{ error: string } | undefined> {
  const admin = await getAdminUser();
  if (!admin) {
    return { error: 'Not authorized' };
  }

  await db.update(ads).set({ active: true }).where(eq(ads.id, id));

  revalidateAdminPaths();
  return undefined;
}
