import { currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ensureAdvertiser } from '@/libs/advertisers';
import { db } from '@/libs/DB';
import { ads, advertisers } from '@/models/Schema';

export default async function DashboardPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const email = user.emailAddresses[0]?.emailAddress ?? '';
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || email;

  await ensureAdvertiser(user.id, email, name);

  const [advertiser] = await db
    .select()
    .from(advertisers)
    .where(eq(advertisers.clerkUserId, user.id))
    .limit(1);

  const activeAdsRows = advertiser
    ? await db
        .select({ id: ads.id })
        .from(ads)
        .where(eq(ads.advertiserId, advertiser.id))
    : [];

  const activeAdsCount = activeAdsRows.length;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">Welcome, {name} 👋</h1>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">Active ads</p>
          <p className="text-3xl font-bold">{activeAdsCount}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="mb-1 text-sm text-white/50">Budget</p>
          <p className="text-3xl font-bold">£0</p>
        </div>
      </div>

      <Link
        href={`/${locale}/advertise/create`}
        className="block w-full rounded-lg bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-500"
      >
        + Create your first ad
      </Link>
    </div>
  );
}
