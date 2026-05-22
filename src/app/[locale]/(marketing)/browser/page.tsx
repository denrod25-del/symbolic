import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ChromeBrowser } from '@/components/ChromeBrowser';

export const metadata: Metadata = {
  title: 'Symbolic Browser',
};

type BrowserPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function BrowserPage(props: BrowserPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen items-center justify-center bg-symbolic-bg p-4 sm:p-8">
      <ChromeBrowser locale={locale} />
    </div>
  );
}
