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
    <main
      className="relative flex min-h-screen flex-col items-center justify-center px-4"
      style={{
        backgroundImage: 'url(/earth.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: '50% 30%',
      }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative flex w-full max-w-xl flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <Image
            src="/logo.png"
            alt="Symbolic"
            width={280}
            height={122}
            priority
          />
          <p className="text-sm text-symbolic-muted">
            Search without compromise
          </p>
        </div>
        <SearchBar autoFocus />
      </div>
    </main>
  );
}
