'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const COOKIE_NAME = 'symbolic_safesearch';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

const LEVELS = [
  {
    value: 'strict',
    labelKey: 'level_strict_label',
    descriptionKey: 'level_strict_description',
  },
  {
    value: 'moderate',
    labelKey: 'level_moderate_label',
    descriptionKey: 'level_moderate_description',
  },
  {
    value: 'off',
    labelKey: 'level_off_label',
    descriptionKey: 'level_off_description',
  },
] as const;

type SafeSearchLevel = 'strict' | 'moderate' | 'off';

export default function SettingsPage() {
  const t = useTranslations('SettingsPage');
  const [safesearch, setSafesearch] = useState<SafeSearchLevel>('moderate');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = getCookie(COOKIE_NAME);
    if (stored === 'strict' || stored === 'moderate' || stored === 'off') {
      setSafesearch(stored);
    }
  }, []);

  function handleChange(value: SafeSearchLevel) {
    setSafesearch(value);
    setCookie(COOKIE_NAME, value);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 1500);
  }

  return (
    <div className="min-h-screen bg-symbolic-bg">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="mb-8 text-2xl font-bold text-symbolic-text">
          {t('title')}
        </h1>

        <div className="rounded-lg border border-symbolic-border bg-symbolic-surface p-6 shadow-symbolic-card">
          <h2 className="mb-1 font-medium text-symbolic-text">
            {t('safe_search_title')}
          </h2>
          <p className="mb-4 text-sm text-symbolic-muted">
            {t('safe_search_description')}
          </p>

          <div className="flex flex-col gap-3">
            {LEVELS.map((level) => (
              <label
                key={level.value}
                htmlFor={`safesearch-${level.value}`}
                aria-label={t(level.labelKey)}
                className="flex cursor-pointer items-start gap-3"
              >
                <input
                  id={`safesearch-${level.value}`}
                  type="radio"
                  name="safesearch"
                  value={level.value}
                  checked={safesearch === level.value}
                  onChange={() => {
                    handleChange(level.value);
                  }}
                  className="mt-1 accent-symbolic-accent"
                />
                <div>
                  <div className="text-symbolic-text">{t(level.labelKey)}</div>
                  <div className="text-sm text-symbolic-muted">
                    {t(level.descriptionKey)}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {saved && (
            <p className="mt-4 text-sm text-symbolic-success">{t('saved')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
