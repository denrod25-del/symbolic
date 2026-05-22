'use client';

import Image from 'next/image';
import { useRef } from 'react';

type BrowserNewTabProps = {
  locale: string;
  onSearch: (input: string) => void;
  onOpen: (entry: string) => void;
};

type Shortcut = {
  label: string;
  letter: string;
  color: string;
  entry: string;
};

function shortcuts(locale: string): Shortcut[] {
  return [
    {
      label: 'Symbolic',
      letter: 'S',
      color: 'bg-symbolic-accent',
      entry: `/${locale}`,
    },
    {
      label: 'Settings',
      letter: '⚙',
      color: 'bg-symbolic-border',
      entry: `/${locale}/settings`,
    },
    {
      label: 'Advertise',
      letter: 'A',
      color: 'bg-symbolic-url',
      entry: `/${locale}/advertise/dashboard`,
    },
    {
      label: 'Wikipedia',
      letter: 'W',
      color: 'bg-symbolic-border',
      entry: 'https://www.wikipedia.org',
    },
    {
      label: 'Hacker News',
      letter: 'Y',
      color: 'bg-[#ff6600]',
      entry: 'https://news.ycombinator.com',
    },
    {
      label: 'MDN',
      letter: 'M',
      color: 'bg-symbolic-link',
      entry: 'https://developer.mozilla.org',
    },
  ];
}

export function BrowserNewTab(props: BrowserNewTabProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex size-full flex-col items-center justify-center gap-10 overflow-y-auto bg-symbolic-bg px-6 py-12">
      <div className="flex flex-col items-center gap-2">
        <Image src="/logo.png" alt="Symbolic" width={160} height={160} />
        <p className="text-sm text-symbolic-muted">Search without compromise</p>
      </div>

      <form
        className="w-full max-w-xl"
        onSubmit={(event: React.SubmitEvent<HTMLFormElement>) => {
          event.preventDefault();
          const value = inputRef.current?.value.trim() ?? '';
          if (value) {
            props.onSearch(value);
          }
        }}
      >
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search the web or type a URL"
            className="w-full rounded-full border border-symbolic-border bg-symbolic-surface px-6 py-3 text-symbolic-text placeholder-symbolic-muted transition-all focus:border-symbolic-accent focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="absolute top-1/2 right-4 -translate-y-1/2 text-symbolic-muted transition-colors hover:text-symbolic-accent"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        </div>
      </form>

      <div className="grid grid-cols-3 gap-6 sm:grid-cols-6">
        {shortcuts(props.locale).map((shortcut) => (
          <button
            key={shortcut.label}
            type="button"
            onClick={() => {
              props.onOpen(shortcut.entry);
            }}
            className="flex w-20 flex-col items-center gap-2"
          >
            <span
              className={`flex size-14 items-center justify-center rounded-full text-xl font-semibold text-symbolic-text ${shortcut.color}`}
            >
              {shortcut.letter}
            </span>
            <span className="truncate text-xs text-symbolic-muted">
              {shortcut.label}
            </span>
          </button>
        ))}
      </div>

      <p className="max-w-md text-center text-xs text-symbolic-muted">
        Some sites block embedding and won&apos;t load here — use the open icon
        to view them in a real tab.
      </p>
    </div>
  );
}
