'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from './Button';

type SearchBarProps = {
  defaultValue?: string;
  autoFocus?: boolean;
};

export function SearchBar(props: SearchBarProps) {
  const t = useTranslations('SearchBar');
  const router = useRouter();
  const [query, setQuery] = useState(props.defaultValue ?? '');

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleLucky() {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}&lucky=1`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          autoFocus={props.autoFocus}
          aria-label={t('placeholder')}
          placeholder={t('placeholder')}
          className="w-full rounded-full border border-symbolic-border bg-symbolic-surface py-3 pr-14 pl-6 text-symbolic-text placeholder-symbolic-muted transition-all focus:border-symbolic-accent focus:outline-none"
        />
        <button
          type="submit"
          aria-label={t('aria_label')}
          className="absolute top-1/2 right-1.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-symbolic-muted transition-colors hover:text-symbolic-accent focus-visible:ring-2 focus-visible:ring-symbolic-accent focus-visible:outline-none"
        >
          <svg
            aria-hidden="true"
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
      <div className="flex justify-center gap-3">
        <Button type="submit">{t('submit')}</Button>
        <Button type="button" onClick={handleLucky}>
          {t('lucky')}
        </Button>
      </div>
    </form>
  );
}
