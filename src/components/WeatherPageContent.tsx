'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Weather } from '@/libs/weather';
import type { StoredLocation } from './WeatherChip';
import { readStoredLocation } from './WeatherChip';

type PageState = 'loading' | 'no-location' | 'failed' | 'ready';

function iconUrl(icon: string): string {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

function smallIconUrl(icon: string): string {
  return `https://openweathermap.org/img/wn/${icon}.png`;
}

function tierClass(tier: 'severe' | 'moderate' | 'minor'): string {
  if (tier === 'severe') {
    return 'border-red-500/40 bg-red-500/10 text-red-300';
  }
  if (tier === 'moderate') {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  }
  return 'border-symbolic-border bg-symbolic-surface text-symbolic-muted';
}

/**
 * Fetches weather for a stored location and reports the result via setters.
 * @param loc - The location to fetch weather for.
 * @param setWeather - Setter called with the parsed weather on success.
 * @param setState - Setter called with the resulting page state.
 */
async function loadWeather(
  loc: StoredLocation,
  setWeather: (w: Weather) => void,
  setState: (s: PageState) => void
): Promise<void> {
  try {
    const res = await fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lon}`);
    if (!res.ok) {
      setState('failed');
      return;
    }
    const weather: Weather = await res.json();
    setWeather(weather);
    setState('ready');
  } catch {
    setState('failed');
  }
}

export function WeatherPageContent(props: { locale: string }) {
  const t = useTranslations('WeatherPage');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [location, setLocation] = useState<StoredLocation | null>(null);
  const [state, setState] = useState<PageState>('loading');

  useEffect(() => {
    const loc = readStoredLocation();
    if (!loc) {
      setState('no-location');
      return;
    }
    setLocation(loc);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget in useEffect; loadWeather reports the outcome via setState internally
    loadWeather(loc, setWeather, setState);
  }, []);

  if (state === 'loading') {
    return null;
  }

  if (state === 'no-location') {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-symbolic-muted">{t('no_location')}</p>
        <Link
          href={`/${props.locale}/settings`}
          className="rounded-md border border-symbolic-border bg-symbolic-surface px-4 py-2 text-sm text-symbolic-text hover:border-symbolic-accent"
        >
          {t('set_location_cta')}
        </Link>
      </div>
    );
  }

  if (state === 'failed' || !weather) {
    return (
      <p className="py-16 text-center text-symbolic-muted">
        {t('unavailable')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-end gap-4">
          <span className="text-6xl font-bold">{weather.current.temp}°F</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- OpenWeatherMap host isn't in next/image remotePatterns */}
          <img
            src={iconUrl(weather.current.icon)}
            alt=""
            width={80}
            height={80}
          />
        </div>
        <div className="mt-1 text-lg text-symbolic-muted capitalize">
          {weather.current.description}
        </div>
        <div className="mt-1 text-sm text-symbolic-muted">
          {location?.label}{' '}
          <Link
            href={`/${props.locale}/settings`}
            className="text-symbolic-accent hover:underline"
          >
            {t('change_location')}
          </Link>
        </div>
      </div>

      {weather.alerts.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('alerts_title')}</h2>
          <div className="flex flex-col gap-3">
            {weather.alerts.map((a) => (
              <div
                key={`${a.event}-${a.end}`}
                className={`rounded-lg border p-4 text-sm ${tierClass(a.tier)}`}
              >
                <div className="font-semibold">{a.event}</div>
                <p className="mt-1 text-xs whitespace-pre-line opacity-80">
                  {a.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('hourly_title')}</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {weather.hourly.map((h) => (
            <div key={h.dt} className="flex flex-col items-center text-sm">
              <span className="text-xs text-symbolic-muted">
                {new Date(h.dt * 1000).toLocaleTimeString([], {
                  hour: 'numeric',
                })}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element -- OpenWeatherMap host isn't in next/image remotePatterns */}
              <img src={smallIconUrl(h.icon)} alt="" width={32} height={32} />
              <span>{h.temp}°</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('daily_title')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {weather.daily.map((d) => (
            <div
              key={d.dt}
              className="flex flex-col items-center rounded-lg border border-symbolic-border bg-symbolic-surface p-3 text-sm"
            >
              <span className="text-xs text-symbolic-muted">
                {new Date(d.dt * 1000).toLocaleDateString([], {
                  weekday: 'short',
                })}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element -- OpenWeatherMap host isn't in next/image remotePatterns */}
              <img src={smallIconUrl(d.icon)} alt="" width={40} height={40} />
              <span>
                {d.max}° / {d.min}°
              </span>
              <span className="text-xs text-symbolic-muted">
                {Math.round(d.pop * 100)}%
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-symbolic-muted">
        {t('attribution')}
      </p>
    </div>
  );
}
