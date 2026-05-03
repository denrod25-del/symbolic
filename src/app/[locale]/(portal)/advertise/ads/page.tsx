import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import { ads, advertisers } from '@/models/Schema';
import { AdRowActions } from './AdRowActions';

export default async function AdsPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const [advertiser] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, user.id))
    .limit(1);

  const advertiserAds = advertiser
    ? await db.select().from(ads).where(eq(ads.advertiserId, advertiser.id))
    : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Ads</h1>
        <Link
          href={`/${locale}/advertise/create`}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500"
        >
          + Create ad
        </Link>
      </div>

      {advertiserAds.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 px-6 py-16 text-center">
          <p className="mb-4 text-white/50">
            No ads yet — create your first one
          </p>
          <Link
            href={`/${locale}/advertise/create`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500"
          >
            Create ad
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="grid grid-cols-[2fr_1fr_80px_100px_160px] gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold tracking-wide text-white/40 uppercase">
            <span>Headline</span>
            <span>Keywords</span>
            <span>Bid</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {advertiserAds.map((ad) => (
            <div
              key={ad.id}
              className="grid grid-cols-[2fr_1fr_80px_100px_160px] items-center gap-4 border-b border-white/5 px-4 py-3 text-sm last:border-0"
            >
              <span className="truncate">{ad.title}</span>
              <span className="truncate text-white/50">
                {ad.keywords.slice(0, 3).join(', ')}
                {ad.keywords.length > 3 ? '…' : ''}
              </span>
              <span>£{(ad.bidAmount / 100).toFixed(2)}</span>
              <span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    ad.active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}
                >
                  {ad.active ? 'Active' : 'Paused'}
                </span>
              </span>
              <AdRowActions adId={ad.id} isActive={ad.active} locale={locale} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
