import { UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { requireAdmin } from '@/libs/admin';

export const metadata: Metadata = {
  title: 'Admin — Symbolic',
};

export default async function AdminLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations('AdminLayout');

  return (
    <div className="min-h-screen bg-[#0d0d14] text-white">
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-8">
          <Link
            href={`/${locale}/admin/dashboard`}
            className="text-sm font-semibold tracking-wide text-white/80"
          >
            {t('logo')}
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href={`/${locale}/admin/dashboard`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_dashboard')}
            </Link>
            <Link
              href={`/${locale}/admin/queue`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_queue')}
            </Link>
            <Link
              href={`/${locale}/admin/ads`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_ads')}
            </Link>
            <Link
              href={`/${locale}/admin/advertisers`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_advertisers')}
            </Link>
          </div>
        </div>
        <UserButton />
      </nav>
      <main>{props.children}</main>
    </div>
  );
}
