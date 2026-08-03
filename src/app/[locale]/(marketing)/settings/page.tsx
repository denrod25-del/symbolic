'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { readStoredLocation } from '@/components/WeatherChip';

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

type SafeSearchLevel = (typeof LEVELS)[number]['value'];

export default function SettingsPage() {
  const t = useTranslations('SettingsPage');
  const [safesearch, setSafesearch] = useState<SafeSearchLevel>('moderate');
  const [saved, setSaved] = useState(false);

  const tLoc = useTranslations('SettingsLocation');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'saved' | 'not_found'
  >('idle');

  useEffect(() => {
    const stored = getCookie(COOKIE_NAME);
    if (stored === 'strict' || stored === 'moderate' || stored === 'off') {
      setSafesearch(stored);
    }
    const storedLocation = readStoredLocation();
    if (storedLocation) {
      setLocationLabel(storedLocation.label || null);
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

  async function handleSaveLocation() {
    const q = locationQuery.trim();
    if (!q) {
      return;
    }
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    if (!response.ok) {
      setLocationStatus('not_found');
      return;
    }
    const result: { lat: number; lon: number; label: string } =
      await response.json();
    window.localStorage.setItem('symbolic_location', JSON.stringify(result));
    setLocationLabel(result.label);
    setLocationStatus('saved');
    setTimeout(() => {
      setLocationStatus('idle');
    }, 1500);
  }

  function handleUseMyLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        label: '',
      };
      window.localStorage.setItem('symbolic_location', JSON.stringify(loc));
      setLocationLabel(null);
      setLocationStatus('saved');
      setTimeout(() => {
        setLocationStatus('idle');
      }, 1500);
    });
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

        <div className="mt-6 rounded-lg border border-symbolic-border bg-symbolic-surface p-6">
          <h2 className="mb-1 font-medium text-symbolic-text">
            {tLoc('title')}
          </h2>
          <p className="mb-4 text-sm text-symbolic-muted">
            {tLoc('description')}
          </p>
          {locationLabel && (
            <p className="mb-3 text-sm text-symbolic-text">
              {tLoc('current', { label: locationLabel })}
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
              }}
              placeholder={tLoc('placeholder')}
              className="flex-1 rounded-md border border-symbolic-border bg-symbolic-bg px-3 py-2 text-sm text-symbolic-text placeholder-symbolic-muted focus:border-symbolic-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveLocation}
              className="rounded-md border border-symbolic-border bg-symbolic-surface px-4 py-2 text-sm text-symbolic-text hover:border-symbolic-accent"
            >
              {tLoc('save')}
            </button>
          </div>
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="mt-3 text-sm text-symbolic-accent hover:underline"
          >
            📍 {tLoc('use_my_location')}
          </button>
          {locationStatus === 'saved' && (
            <p className="mt-3 text-sm text-symbolic-url">{tLoc('saved')}</p>
          )}
          {locationStatus === 'not_found' && (
            <p className="mt-3 text-sm text-red-400">{tLoc('not_found')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
