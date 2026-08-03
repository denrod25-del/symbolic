import { Env } from './Env';

export type AlertTier = 'severe' | 'moderate' | 'minor';

export type WeatherAlert = {
  event: string;
  sender: string;
  start: number;
  end: number;
  description: string;
  tier: AlertTier;
};

export type Weather = {
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    description: string;
    icon: string;
  };
  today: { min: number; max: number };
  hourly: { dt: number; temp: number; icon: string }[];
  daily: {
    dt: number;
    min: number;
    max: number;
    pop: number;
    description: string;
    icon: string;
  }[];
  alerts: WeatherAlert[];
};

export type GeoResult = { lat: number; lon: number; label: string };

const ONE_CALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const GEO_URL = 'https://api.openweathermap.org/geo/1.0/direct';

const SEVERE_RE = /tornado|hurricane|extreme|evacuat|tsunami|storm surge/i;
const MODERATE_RE = /warning|watch/i;

/**
 * Classifies an alert event name into a display tier.
 * @param event - The alert event name from OpenWeatherMap.
 * @returns The severity tier used by the UI.
 */
export function alertTier(event: string): AlertTier {
  if (SEVERE_RE.test(event)) {
    return 'severe';
  }
  if (MODERATE_RE.test(event)) {
    return 'moderate';
  }
  return 'minor';
}

type OwmWeather = { description: string; icon: string };
type OwmOneCall = {
  current: {
    temp: number;
    feels_like: number;
    humidity: number;
    wind_speed: number;
    weather: OwmWeather[];
  };
  hourly: { dt: number; temp: number; weather: OwmWeather[] }[];
  daily: {
    dt: number;
    temp: { min: number; max: number };
    pop: number;
    weather: OwmWeather[];
  }[];
  alerts?: {
    sender_name: string;
    event: string;
    start: number;
    end: number;
    description: string;
  }[];
};

/**
 * Fetches current conditions, forecast, and alerts for a coordinate.
 * Temperatures are imperial (°F); the client converts to °C on demand.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns The mapped weather data.
 * @throws When the API responds with a non-ok status.
 */
export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const url = new URL(ONE_CALL_URL);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('units', 'imperial');
  url.searchParams.set('exclude', 'minutely');
  url.searchParams.set('appid', Env.OPENWEATHER_API_KEY ?? '');

  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`OpenWeatherMap error: ${response.status}`);
  }
  const data: OwmOneCall = await response.json();

  const [today] = data.daily;
  return {
    current: {
      temp: Math.round(data.current.temp),
      feelsLike: Math.round(data.current.feels_like),
      humidity: data.current.humidity,
      windSpeed: Math.round(data.current.wind_speed),
      description: data.current.weather[0]?.description ?? '',
      icon: data.current.weather[0]?.icon ?? '01d',
    },
    today: {
      min: Math.round(today?.temp.min ?? 0),
      max: Math.round(today?.temp.max ?? 0),
    },
    hourly: data.hourly.slice(0, 12).map((h) => ({
      dt: h.dt,
      temp: Math.round(h.temp),
      icon: h.weather[0]?.icon ?? '01d',
    })),
    daily: data.daily.slice(0, 7).map((d) => ({
      dt: d.dt,
      min: Math.round(d.temp.min),
      max: Math.round(d.temp.max),
      pop: d.pop,
      description: d.weather[0]?.description ?? '',
      icon: d.weather[0]?.icon ?? '01d',
    })),
    alerts: (data.alerts ?? []).map((a) => ({
      event: a.event,
      sender: a.sender_name,
      start: a.start,
      end: a.end,
      description: a.description,
      tier: alertTier(a.event),
    })),
  };
}

type OwmGeo = {
  name: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
};

/**
 * Geocodes a free-text city or zip query to coordinates.
 * @param query - City name or zip code.
 * @returns The first match, or null when nothing matches.
 * @throws When the API responds with a non-ok status.
 */
export async function geocodeCity(query: string): Promise<GeoResult | null> {
  const url = new URL(GEO_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');
  url.searchParams.set('appid', Env.OPENWEATHER_API_KEY ?? '');

  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Geocoding error: ${response.status}`);
  }
  const results: OwmGeo[] = await response.json();
  const [first] = results;
  if (!first) {
    return null;
  }
  return {
    lat: first.lat,
    lon: first.lon,
    label: [first.name, first.state ?? first.country]
      .filter(Boolean)
      .join(', '),
  };
}
