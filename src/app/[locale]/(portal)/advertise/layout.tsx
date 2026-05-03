import { UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Dashboard — Symbolic Ads',
};

export default async function AdvertiseLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  return (
    <div className="min-h-screen bg-[#0d0d14] text-white">
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-8">
          <Link
            href={`/${locale}/advertise/dashboard`}
            className="flex items-center gap-3"
          >
            <Image src="/logo.png" alt="Symbolic" width={100} height={44} />
            <span className="text-sm font-semibold tracking-wide text-white/60">
              Ads
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href={`/${locale}/advertise/dashboard`}
              className="text-sm text-white/60 hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href={`/${locale}/advertise/ads`}
              className="text-sm text-white/60 hover:text-white"
            >
              My Ads
            </Link>
          </div>
        </div>
        <UserButton />
      </nav>
      <main>{props.children}</main>
    </div>
  );
}
