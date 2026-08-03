import { afterEach, describe, expect, it, vi } from 'vitest';
import { alertTier, fetchWeather, geocodeCity } from './weather';

const owmFixture = {
  current: {
    temp: 78.3,
    feels_like: 80.1,
    humidity: 65,
    wind_speed: 8.5,
    weather: [{ description: 'scattered clouds', icon: '03d' }],
  },
  hourly: Array.from({ length: 24 }, (_, i) => ({
    dt: 1_700_000_000 + i * 3600,
    temp: 70 + i,
    weather: [{ description: 'clear', icon: '01d' }],
  })),
  daily: Array.from({ length: 8 }, (_, i) => ({
    dt: 1_700_000_000 + i * 86_400,
    temp: { min: 60 + i, max: 80 + i },
    pop: 0.2,
    weather: [{ description: 'clear', icon: '01d' }],
  })),
  alerts: [
    {
      sender_name: 'NWS',
      event: 'Tornado Warning',
      start: 1_700_000_000,
      end: 1_700_010_000,
      description: 'Take cover now.',
    },
  ],
};

function mockFetchOnce(json: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: () => json })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('weather', () => {
  describe('alertTier', () => {
    it('classifies tornado warning as severe', () => {
      expect(alertTier('Tornado Warning')).toBe('severe');
    });

    it('classifies hurricane warning as severe', () => {
      expect(alertTier('Hurricane Warning')).toBe('severe');
    });

    it('classifies thunderstorm watch as moderate', () => {
      expect(alertTier('Severe Thunderstorm Watch')).toBe('moderate');
    });

    it('classifies flood warning as moderate', () => {
      expect(alertTier('Flood Warning')).toBe('moderate');
    });

    it('classifies air quality advisory as minor', () => {
      expect(alertTier('Air Quality Advisory')).toBe('minor');
    });
  });

  describe('fetchWeather', () => {
    it('maps the one-call response to the internal shape', async () => {
      mockFetchOnce(owmFixture);
      const w = await fetchWeather(26.71, -80.05);

      expect(w.current.temp).toBe(78);
      expect(w.current.description).toBe('scattered clouds');
      expect(w.hourly).toHaveLength(12);
      expect(w.daily).toHaveLength(7);
      expect(w.alerts[0]?.tier).toBe('severe');
      expect(w.alerts[0]?.event).toBe('Tornado Warning');
    });

    it('returns empty alerts when the field is absent', async () => {
      mockFetchOnce({ ...owmFixture, alerts: undefined });
      const w = await fetchWeather(26.71, -80.05);
      expect(w.alerts).toEqual([]);
    });

    it('throws on a non-ok response', async () => {
      mockFetchOnce({}, false);
      await expect(fetchWeather(0, 0)).rejects.toThrow();
    });
  });

  describe('geocodeCity', () => {
    it('maps the first geocoding result', async () => {
      mockFetchOnce([
        {
          name: 'West Palm Beach',
          state: 'Florida',
          country: 'US',
          lat: 26.71,
          lon: -80.05,
        },
      ]);
      const g = await geocodeCity('west palm beach');
      expect(g).toEqual({
        lat: 26.71,
        lon: -80.05,
        label: 'West Palm Beach, Florida',
      });
    });

    it('returns null when there are no results', async () => {
      mockFetchOnce([]);
      expect(await geocodeCity('xyzzy')).toBeNull();
    });
  });
});
