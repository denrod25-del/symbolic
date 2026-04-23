import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
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
          <h1 className="symbolic-glow text-6xl font-bold tracking-tight text-white">
            Symbolic
          </h1>
          <p className="text-sm text-symbolic-muted">
            Search without compromise
          </p>
        </div>
        <SearchBar autoFocus />
      </div>
    </main>
  );
}
