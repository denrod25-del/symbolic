import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { SearchBar } from '@/components/SearchBar';

export const metadata: Metadata = {
  title: 'Symbolic — Search without compromise',
};

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage(props: HomePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-symbolic-bg px-4">
      <div className="flex w-full max-w-xl flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <Image
            src="/logo.png"
            alt="Symbolic"
            width={220}
            height={220}
            priority
          />
          <p className="text-sm text-symbolic-muted">
            Search without compromise
          </p>
        </div>
        <SearchBar autoFocus />
        <Link
          href="/browser"
          className="text-sm text-symbolic-muted transition-colors hover:text-symbolic-accent"
        >
          Open the Symbolic Browser →
        </Link>
      </div>
    </main>
  );
}
