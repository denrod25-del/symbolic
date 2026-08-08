import { afterEach, describe, expect, it, vi } from 'vitest';
import { alertTier, fetchWeather, geocodeCity } from './weather';

const POINTS_KEY = '/points/';
const STATIONS_KEY = '/gridpoints/OKX/33,35/stations';
const OBS_KEY = '/observations/latest';
const HOURLY_KEY = '/forecast/hourly';
const ALERTS_KEY = '/alerts/active';

const pointsFixture = {
  properties: {
    forecast: 'https://api.weather.gov/gridpoints/OKX/33,35/forecast',
    forecastHourly: `https://api.weather.gov${HOURLY_KEY}`,
    observationStations: `https://api.weather.gov${STATIONS_KEY}`,
    relativeLocation: {
      properties: { city: 'West Palm Beach', state: 'FL' },
    },
  },
};

const stationsFixture = {
  features: [{ properties: { stationIdentifier: 'KPBI' } }],
};

const observationFixture = {
  properties: {
    temperature: { value: 25.6 },
    heatIndex: { value: null },
    windChill: { value: null },
    relativeHumidity: { value: 65 },
    windSpeed: { value: 13.7 },
    textDescription: 'Partly Cloudy',
    icon: 'https://api.weather.gov/icons/land/day/few?size=medium',
  },
};

function forecastPeriod(overrides: Partial<Record<string, unknown>>) {
  return {
    number: 1,
    name: 'Today',
    startTime: '2026-08-08T06:00:00-04:00',
    isDaytime: true,
    temperature: 88,
    shortForecast: 'Sunny',
    icon: 'https://api.weather.gov/icons/land/day/skc?size=medium',
    probabilityOfPrecipitation: { value: 10 },
    ...overrides,
  };
}

const forecastFixture = {
  properties: {
    periods: [
      forecastPeriod({
        startTime: '2026-08-08T06:00:00-04:00',
        isDaytime: true,
        temperature: 88,
        probabilityOfPrecipitation: { value: 10 },
      }),
      forecastPeriod({
        startTime: '2026-08-08T18:00:00-04:00',
        isDaytime: false,
        temperature: 74,
        shortForecast: 'Clear',
        probabilityOfPrecipitation: { value: 20 },
      }),
      forecastPeriod({
        startTime: '2026-08-09T06:00:00-04:00',
        isDaytime: true,
        temperature: 90,
        probabilityOfPrecipitation: { value: 5 },
      }),
      forecastPeriod({
        startTime: '2026-08-09T18:00:00-04:00',
        isDaytime: false,
        temperature: 76,
        probabilityOfPrecipitation: { value: 15 },
      }),
    ],
  },
};

const hourlyFixture = {
  properties: {
    periods: Array.from({ length: 24 }, (_, i) => ({
      startTime: `2026-08-08T${String(i).padStart(2, '0')}:00:00-04:00`,
      temperature: 80 + i,
      icon: `https://api.weather.gov/icons/land/day/skc?size=small&idx=${i}`,
    })),
  },
};

const alertsFixture = {
  features: [
    {
      properties: {
        event: 'Severe Thunderstorm Warning',
        senderName: 'NWS Miami',
        headline: 'Severe Thunderstorm Warning issued',
        description: 'Take shelter now.',
        onset: '2026-08-08T12:00:00-04:00',
        effective: '2026-08-08T12:00:00-04:00',
        ends: '2026-08-08T13:00:00-04:00',
        expires: '2026-08-08T13:00:00-04:00',
        severity: 'Severe',
      },
    },
  ],
};

function mockEndpoints(
  map: Record<string, unknown>,
  okOverride?: Record<string, boolean>
) {
  vi.stubGlobal(
    'fetch',
    vi.fn( async (url: string | URL) => {
      const href = url.toString();
      const key = Object.keys(map).find((k) => href.includes(k));
      if (!key) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json:  async () => Promise.resolve({}),
        });
      }
      const ok = okOverride?.[key] ?? true;
      return Promise.resolve({
        ok,
        status: ok ? 200 : 500,
        json:  async () => Promise.resolve(map[key]),
      });
    })
  );
}

function mockAllEndpoints(overrides?: {
  observation?: unknown;
  okOverride?: Record<string, boolean>;
}) {
  mockEndpoints(
    {
      [POINTS_KEY]: pointsFixture,
      [STATIONS_KEY]: stationsFixture,
      [OBS_KEY]: overrides?.observation ?? observationFixture,
      [HOURLY_KEY]: hourlyFixture,
      '/gridpoints/OKX/33,35/forecast': forecastFixture,
      [ALERTS_KEY]: alertsFixture,
    },
    overrides?.okOverride
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('weather', () => {
  describe('alertTier', () => {
    it('classifies extreme severity as severe', () => {
      expect(alertTier('Extreme')).toBe('severe');
    });

    it('classifies severe severity as severe', () => {
      expect(alertTier('Severe')).toBe('severe');
    });

    it('classifies moderate severity as moderate', () => {
      expect(alertTier('Moderate')).toBe('moderate');
    });

    it('classifies minor severity as minor', () => {
      expect(alertTier('Minor')).toBe('minor');
    });

    it('classifies unknown severity as minor', () => {
      expect(alertTier('Unknown')).toBe('minor');
    });
  });

  describe('fetchWeather', () => {
    it('converts current temperature from celsius to fahrenheit', async () => {
      mockAllEndpoints();
      const w = await fetchWeather(26.71, -80.05);
      expect(w.current.temp).toBe(78);
    });

    it('returns twelve hourly entries', async () => {
      mockAllEndpoints();
      const w = await fetchWeather(26.71, -80.05);
      expect(w.hourly).toHaveLength(12);
    });

    it('pairs day/night periods into seven daily entries', async () => {
      mockAllEndpoints();
      const w = await fetchWeather(26.71, -80.05);
      expect(w.daily.length).toBeLessThanOrEqual(7);
      expect(w.daily[0]).toMatchObject({ min: 74, max: 88 });
      expect(w.daily[1]).toMatchObject({ min: 76, max: 90 });
    });

    it('maps NWS severity to alert tier', async () => {
      mockAllEndpoints();
      const w = await fetchWeather(26.71, -80.05);
      expect(w.alerts[0]?.tier).toBe('severe');
      expect(w.alerts[0]?.event).toBe('Severe Thunderstorm Warning');
    });

    it('returns empty alerts when features is empty', async () => {
      mockEndpoints({
        [POINTS_KEY]: pointsFixture,
        [STATIONS_KEY]: stationsFixture,
        [OBS_KEY]: observationFixture,
        [HOURLY_KEY]: hourlyFixture,
        '/gridpoints/OKX/33,35/forecast': forecastFixture,
        [ALERTS_KEY]: { features: [] },
      });
      const w = await fetchWeather(26.71, -80.05);
      expect(w.alerts).toEqual([]);
    });

    it('throws on a non-ok points response', async () => {
      mockAllEndpoints({ okOverride: { [POINTS_KEY]: false } });
      await expect(fetchWeather(0, 0)).rejects.toThrow();
    });

    it('falls back to the hourly temperature when observation is null', async () => {
      mockAllEndpoints({
        observation: {
          properties: {
            temperature: { value: null },
            heatIndex: { value: null },
            windChill: { value: null },
            relativeHumidity: { value: null },
            windSpeed: { value: null },
            textDescription: null,
            icon: null,
          },
        },
      });
      const w = await fetchWeather(26.71, -80.05);
      expect(w.current.temp).toBe(80);
      expect(w.current.humidity).toBe(0);
      expect(w.current.windSpeed).toBe(0);
    });
  });

  describe('geocodeCity', () => {
    it('maps the first result including admin1 as the label suffix', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json:  async () =>
            Promise.resolve({
              results: [
                {
                  latitude: 26.71,
                  longitude: -80.05,
                  name: 'West Palm Beach',
                  admin1: 'Florida',
                  country_code: 'US',
                },
              ],
            }),
        })
      );
      const g = await geocodeCity('west palm beach');
      expect(g).toEqual({
        lat: 26.71,
        lon: -80.05,
        label: 'West Palm Beach, Florida',
      });
    });

    it('returns null when there are no results', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json:  async () => Promise.resolve({}),
        })
      );
      expect(await geocodeCity('xyzzy')).toBeNull();
    });
  });
});
