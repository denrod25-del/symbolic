'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setHiddenSources } from '@/libs/newsPreferences';

const SOURCE_LABELS: Record<string, string> = {
  verge: 'The Verge',
  techcrunch: 'TechCrunch',
  ars: 'Ars Technica',
  wired: 'Wired',
  hn: 'Hacker News',
};

export function SourcesPopover(props: {
  signedIn: boolean;
  hiddenSources: string[];
  labels: { sources: string; signin: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>(props.hiddenSources);
  const [busy, setBusy] = useState(false);

  async function toggle(source: string) {
    const next = hidden.includes(source)
      ? hidden.filter((s) => s !== source)
      : [...hidden, source];
    setHidden(next);
    setBusy(true);
    await setHiddenSources(next);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
        }}
        className="rounded border border-symbolic-border px-3 py-1 text-xs text-symbolic-muted hover:text-symbolic-text"
      >
        {props.labels.sources} ▾
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-symbolic-border bg-symbolic-surface p-3 text-sm shadow-xl">
          {props.signedIn ? (
            Object.entries(SOURCE_LABELS).map(([key, label]) => (
              <label
                key={key}
                htmlFor={`source-${key}`}
                className="flex cursor-pointer items-center gap-2 py-1 text-symbolic-text"
              >
                <input
                  id={`source-${key}`}
                  type="checkbox"
                  disabled={busy}
                  checked={!hidden.includes(key)}
                  onChange={async () => {
                    await toggle(key);
                  }}
                  className="accent-symbolic-accent"
                />
                {label}
              </label>
            ))
          ) : (
            <p className="text-xs text-symbolic-muted">{props.labels.signin}</p>
          )}
        </div>
      )}
    </div>
  );
}
