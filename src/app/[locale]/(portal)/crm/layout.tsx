import { UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'CRM — Symbolic',
};

export default async function CrmLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CrmLayout');

  return (
    <div className="min-h-screen bg-[#0d0d14] text-white">
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-8">
          <Link
            href={`/${locale}/crm/dashboard`}
            className="flex items-center gap-3"
          >
            <Image src="/logo.png" alt="Symbolic" width={100} height={44} />
            <span className="text-sm font-semibold tracking-wide text-white/60">
              CRM
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href={`/${locale}/crm/dashboard`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_dashboard')}
            </Link>
            <Link
              href={`/${locale}/crm/contacts`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_contacts')}
            </Link>
            <Link
              href={`/${locale}/crm/pipeline`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_pipeline')}
            </Link>
            <Link
              href={`/${locale}/crm/calendar`}
              className="text-sm text-white/60 hover:text-white"
            >
              {t('nav_calendar')}
            </Link>
          </div>
        </div>
        <UserButton />
      </nav>
      <main>{props.children}</main>
    </div>
  );
}
