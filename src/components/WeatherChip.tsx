'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Weather } from '@/libs/weather';

const LOCATION_KEY = 'symbolic_location';
const UNITS_KEY = 'symbolic_units';

export type StoredLocation = { lat: number; lon: number; label: string };

/**
 * Reads the stored location from localStorage.
 * @returns The stored location, or null when unset or invalid.
 */
export function readStoredLocation(): StoredLocation | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(LOCATION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'lat' in parsed &&
      'lon' in parsed &&
      'label' in parsed
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      return parsed as StoredLocation;
    }
    return null;
  } catch {
    return null;
  }
}

function toC(f: number): number {
  return Math.round(((f - 32) * 5) / 9);
}

function iconUrl(icon: string): string {
  return `https://openweathermap.org/img/wn/${icon}.png`;
}

/**
 * Fetches weather for a stored location and reports the result via setters.
 * @param loc - The location to fetch weather for.
 * @param setWeather - Setter called with the parsed weather on success.
 * @param setFailed - Setter called with true when the request fails.
 */
async function loadWeather(
  loc: StoredLocation,
  setWeather: (w: Weather) => void,
  setFailed: (v: boolean) => void
): Promise<void> {
  try {
    const res = await fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lon}`);
    if (!res.ok) {
      setFailed(true);
      return;
    }
    const weather: Weather = await res.json();
    setWeather(weather);
  } catch {
    setFailed(true);
  }
}

function alertClass(tier: 'severe' | 'moderate' | 'minor'): string {
  if (tier === 'severe') {
    return 'bg-red-500/20 text-red-400';
  }
  if (tier === 'moderate') {
    return 'bg-amber-500/20 text-amber-400';
  }
  return 'bg-white/10 text-symbolic-muted';
}

export function WeatherChip(props: { locale: string }) {
  const t = useTranslations('WeatherChip');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [location, setLocation] = useState<StoredLocation | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [celsius, setCelsius] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    const loc = readStoredLocation();
    setCelsius(window.localStorage.getItem(UNITS_KEY) === 'c');
    const rawDismissed =
      window.sessionStorage.getItem('symbolic_dismissed_alerts') ?? '[]';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    setDismissed(JSON.parse(rawDismissed) as string[]);
    if (loc) {
      setLocation(loc);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget in useEffect; loadWeather reports failure via setFailed internally
      loadWeather(loc, setWeather, setFailed);
    }
  }, []);

  function requestGeolocation() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: '',
        };
        window.localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
        window.location.reload();
      },
      () => {
        window.location.href = `/${props.locale}/settings`;
      }
    );
  }

  function toggleUnits() {
    const next = !celsius;
    setCelsius(next);
    window.localStorage.setItem(UNITS_KEY, next ? 'c' : 'f');
  }

  function dismissAlert(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    window.sessionStorage.setItem(
      'symbolic_dismissed_alerts',
      JSON.stringify(next)
    );
  }

  function fmt(tempF: number): string {
    return celsius ? `${toC(tempF)}°C` : `${tempF}°F`;
  }

  if (failed) {
    return null;
  }

  const alerts = weather?.alerts ?? [];
  const severe = alerts.find(
    (a) => a.tier === 'severe' && !dismissed.includes(`${a.event}-${a.end}`)
  );
  const hasModerate = alerts.some((a) => a.tier === 'moderate');

  return (
    <>
      {severe && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-red-600 px-4 py-2 text-sm font-semibold text-white">
          <span>
            ⚠ {severe.event} —{' '}
            {t('alert_until', {
              time: new Date(severe.end * 1000).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              }),
            })}
          </span>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
            className="underline"
          >
            {t('banner_details')}
          </button>
          <button
            type="button"
            aria-label={t('banner_dismiss')}
            onClick={() => {
              dismissAlert(`${severe.event}-${severe.end}`);
            }}
            className="ml-2"
          >
            ✕
          </button>
        </div>
      )}

      <div className="fixed top-4 right-4 z-40">
        {location && weather ? (
          <button
            type="button"
            onClick={() => {
              setOpen(!open);
            }}
            className="relative flex items-center gap-1.5 rounded-full border border-symbolic-border bg-symbolic-surface/90 px-3 py-1.5 text-sm text-symbolic-text backdrop-blur hover:border-symbolic-accent"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- OpenWeatherMap host isn't in next/image remotePatterns */}
            <img
              src={iconUrl(weather.current.icon)}
              alt=""
              width={20}
              height={20}
            />
            {fmt(weather.current.temp)}
            {hasModerate && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={requestGeolocation}
            className="rounded-full border border-symbolic-border bg-symbolic-surface/90 px-3 py-1.5 text-sm text-symbolic-muted backdrop-blur hover:border-symbolic-accent"
          >
            📍 {t('set_location')}
          </button>
        )}

        {open && weather && (
          <div className="mt-2 w-72 rounded-lg border border-symbolic-border bg-symbolic-surface p-4 text-sm text-symbolic-text shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-3xl font-bold">
                  {fmt(weather.current.temp)}
                </div>
                <div className="text-symbolic-muted capitalize">
                  {weather.current.description}
                </div>
              </div>
              <button
                type="button"
                onClick={toggleUnits}
                className="rounded border border-symbolic-border px-2 py-0.5 text-xs text-symbolic-muted hover:text-symbolic-text"
              >
                °F / °C
              </button>
            </div>
            <div className="mt-2 text-xs text-symbolic-muted">
              {t('feels_like', {
                temp: celsius
                  ? toC(weather.current.feelsLike)
                  : weather.current.feelsLike,
              })}{' '}
              · {t('humidity', { value: weather.current.humidity })} ·{' '}
              {t('wind', { value: weather.current.windSpeed })}
            </div>
            <div className="mt-1 text-xs text-symbolic-muted">
              {t('today_range', {
                max: celsius ? toC(weather.today.max) : weather.today.max,
                min: celsius ? toC(weather.today.min) : weather.today.min,
              })}
            </div>

            {alerts.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {alerts.map((a) => (
                  <div
                    key={`${a.event}-${a.end}`}
                    className={`rounded px-2 py-1 text-xs ${alertClass(a.tier)}`}
                  >
                    {a.event}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex gap-3 border-t border-symbolic-border pt-2">
              {weather.daily.slice(1, 4).map((d) => (
                <div key={d.dt} className="flex flex-col items-center text-xs">
                  <span className="text-symbolic-muted">
                    {new Date(d.dt * 1000).toLocaleDateString([], {
                      weekday: 'short',
                    })}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element -- OpenWeatherMap host isn't in next/image remotePatterns */}
                  <img src={iconUrl(d.icon)} alt="" width={24} height={24} />
                  <span>
                    {celsius ? toC(d.max) : d.max}° /{' '}
                    {celsius ? toC(d.min) : d.min}°
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-symbolic-border pt-2 text-xs">
              <Link
                href={`/${props.locale}/weather`}
                className="text-symbolic-accent hover:underline"
              >
                {t('full_forecast')}
              </Link>
              <span className="text-symbolic-muted">{t('attribution')}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
