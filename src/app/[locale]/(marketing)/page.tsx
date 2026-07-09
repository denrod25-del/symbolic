import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
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
    <section className="symbolic-hero relative flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="sr-only">
        Symbolic — private web search without compromise
      </h1>
      <div className="relative flex w-full max-w-xl flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <Image
            src="/logo.png"
            alt="Symbolic"
            width={280}
            height={122}
            priority
            className="h-auto w-56 sm:w-[280px]"
          />
          <p className="text-sm text-symbolic-muted">
            Search without compromise
          </p>
        </div>
        <SearchBar autoFocus />
        <p className="text-center text-xs text-symbolic-muted">
          Private by default — no tracking, no profiles. Powered by Brave
          Search.
        </p>
      </div>
    </section>
  );
}
