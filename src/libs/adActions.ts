'use server';

import { currentUser } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { ads, advertisers } from '@/models/Schema';
import { db } from './DB';

const adFormSchema = z.object({
  title: z.string().min(1).max(80),
  url: z.url(),
  displayUrl: z.string().min(1).max(60),
  description: z.string().max(200).default(''),
  ctaText: z.string().min(1).max(30),
  keywords: z.string().min(1),
  bidPounds: z.coerce.number().min(0.1),
});

type AdFormData = z.input<typeof adFormSchema>;

async function getAdvertiser(clerkUserId: string) {
  const [row] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, clerkUserId))
    .limit(1);
  return row ?? null;
}

function parseKeywords(raw: string): string[] {
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Creates a new ad for the signed-in advertiser.
 * @param data - Validated ad form fields.
 * @returns Success indicator or an error message.
 */
export async function createAd(
  data: AdFormData
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const parsed = adFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const advertiser = await getAdvertiser(user.id);
  if (!advertiser) {
    return { error: 'Advertiser account not found' };
  }

  const { title, url, displayUrl, description, ctaText, keywords, bidPounds } =
    parsed.data;

  await db.insert(ads).values({
    advertiserId: advertiser.id,
    advertiserName: advertiser.name,
    title,
    url,
    displayUrl,
    description,
    ctaText,
    keywords: parseKeywords(keywords),
    bidAmount: Math.round(bidPounds * 100),
    active: true,
  });

  return { success: true };
}

/**
 * Updates an existing ad. Verifies ownership before updating.
 * @param id - The ad's database ID.
 * @param data - Updated ad form fields.
 * @returns Success indicator or an error message.
 */
export async function updateAd(
  id: number,
  data: AdFormData
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const parsed = adFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const advertiser = await getAdvertiser(user.id);
  if (!advertiser) {
    return { error: 'Advertiser account not found' };
  }

  const { title, url, displayUrl, description, ctaText, keywords, bidPounds } =
    parsed.data;

  const updated = await db
    .update(ads)
    .set({
      title,
      url,
      displayUrl,
      description,
      ctaText,
      keywords: parseKeywords(keywords),
      bidAmount: Math.round(bidPounds * 100),
    })
    .where(and(eq(ads.id, id), eq(ads.advertiserId, advertiser.id)))
    .returning({ id: ads.id });

  if (updated.length === 0) {
    return { error: 'Ad not found' };
  }

  return { success: true };
}

/**
 * Flips the active flag on an ad. Verifies ownership first.
 * @param id - The ad's database ID.
 * @param locale - Current locale used to revalidate the ads page path.
 * @returns An error message object on failure, or undefined on success.
 */
export async function toggleAdActive(
  id: number,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const advertiser = await getAdvertiser(user.id);
  if (!advertiser) {
    return { error: 'Advertiser account not found' };
  }

  const [ad] = await db
    .select({ active: ads.active })
    .from(ads)
    .where(and(eq(ads.id, id), eq(ads.advertiserId, advertiser.id)))
    .limit(1);

  if (!ad) {
    return { error: 'Ad not found' };
  }

  await db
    .update(ads)
    .set({ active: !ad.active })
    .where(and(eq(ads.id, id), eq(ads.advertiserId, advertiser.id)));

  try {
    revalidatePath(`/${locale}/advertise/ads`);
  } catch {
    // no-op outside Next.js runtime
  }

  return undefined;
}

/**
 * Deletes an ad. Verifies ownership before deleting.
 * @param id - The ad's database ID.
 * @param locale - Current locale used to revalidate the ads page path.
 * @returns An error message object on failure, or undefined on success.
 */
export async function deleteAd(
  id: number,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const advertiser = await getAdvertiser(user.id);
  if (!advertiser) {
    return { error: 'Advertiser account not found' };
  }

  const [ad] = await db
    .select({ id: ads.id })
    .from(ads)
    .where(and(eq(ads.id, id), eq(ads.advertiserId, advertiser.id)))
    .limit(1);

  if (!ad) {
    return;
  }

  await db.delete(ads).where(eq(ads.id, id));

  try {
    revalidatePath(`/${locale}/advertise/ads`);
  } catch {
    // no-op outside Next.js runtime
  }

  return undefined;
}
