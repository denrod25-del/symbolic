import { currentUser } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { AdWizard } from '@/components/AdWizard';
import { db } from '@/libs/DB';
import { ads, advertisers } from '@/models/Schema';

export default async function EditPage(props: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await props.params;
  const user = await currentUser();
  if (!user) {redirect(`/${locale}/advertise/sign-in`);}

  const [advertiser] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, user.id))
    .limit(1);

  if (!advertiser) {redirect(`/${locale}/advertise/sign-in`);}

  const adId = Number(id);
  const [ad] = await db
    .select()
    .from(ads)
    .where(and(eq(ads.id, adId), eq(ads.advertiserId, advertiser.id)))
    .limit(1);

  if (!ad) {notFound();}

  return (
    <AdWizard
      locale={locale}
      initialData={{
        id: ad.id,
        title: ad.title,
        url: ad.url,
        displayUrl: ad.displayUrl,
        description: ad.description,
        ctaText: ad.ctaText,
        keywords: ad.keywords,
        bidAmount: ad.bidAmount,
      }}
    />
  );
}
