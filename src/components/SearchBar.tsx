'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type SearchBarProps = {
  defaultValue?: string;
  autoFocus?: boolean;
};

export function SearchBar(props: SearchBarProps) {
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
          placeholder="Search the web..."
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
      <div className="flex justify-center gap-3">
        <button
          type="submit"
          className="rounded-md border border-symbolic-border bg-symbolic-surface px-5 py-2 text-sm text-symbolic-text transition-colors hover:border-symbolic-accent"
        >
          Search
        </button>
        <button
          type="button"
          onClick={handleLucky}
          className="rounded-md border border-symbolic-border bg-symbolic-surface px-5 py-2 text-sm text-symbolic-text transition-colors hover:border-symbolic-accent"
        >
          I&apos;m Feeling Lucky
        </button>
      </div>
    </form>
  );
}
