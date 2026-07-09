import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

export default async function Loading() {
  const t = await getTranslations('SearchPage');

  return (
    <div className="min-h-screen bg-symbolic-bg">
      <header className="sticky top-0 z-10 border-b border-symbolic-border bg-symbolic-bg">
        <div className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
          <Image
            src="/logo.png"
            alt="Symbolic"
            width={64}
            height={64}
            className="shrink-0"
          />
          <div className="h-11 w-full max-w-xl rounded-full border border-symbolic-border bg-symbolic-surface" />
        </div>
      </header>

      <p className="sr-only" role="status">
        {t('searching')}
      </p>

      <div className="mx-auto max-w-2xl px-4 py-6" aria-hidden>
        <ul className="flex flex-col gap-7">
          {SKELETON_ROWS.map((row) => (
            <li key={row} className="flex flex-col gap-2">
              <div className="symbolic-shimmer h-3 w-40 rounded" />
              <div className="symbolic-shimmer h-5 w-3/4 rounded" />
              <div className="symbolic-shimmer h-3 w-full rounded" />
              <div className="symbolic-shimmer h-3 w-5/6 rounded" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
