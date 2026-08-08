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

const USER_AGENT = 'SymbolicWeather/1.0 (+https://bsymbolic.com)';
const ALERTS_URL = 'https://api.weather.gov/alerts/active';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

/**
 * Classifies an NWS alert severity into a display tier.
 * @param severity - The `properties.severity` field from a weather.gov alert.
 * @returns The severity tier used by the UI.
 */
export function alertTier(severity: string): AlertTier {
  if (severity === 'Extreme' || severity === 'Severe') {
    return 'severe';
  }
  if (severity === 'Moderate') {
    return 'moderate';
  }
  return 'minor';
}

type NwsPoint = {
  properties: {
    forecast: string;
    forecastHourly: string;
    observationStations: string;
  };
};

type NwsStations = {
  features: { properties: { stationIdentifier: string } }[];
};

// Degraded stations can omit measurement objects entirely, not just report a
// null `value` — every nested read below is optional-chained accordingly.
type NwsMeasurement = { value: number | null } | null;

type NwsObservation = {
  properties: {
    temperature?: NwsMeasurement;
    heatIndex?: NwsMeasurement;
    windChill?: NwsMeasurement;
    relativeHumidity?: NwsMeasurement;
    windSpeed?: NwsMeasurement;
    textDescription: string | null;
    icon: string | null;
  };
};

type NwsForecastPeriod = {
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  shortForecast: string;
  icon: string;
  probabilityOfPrecipitation?: NwsMeasurement;
};

type NwsForecast = { properties: { periods: NwsForecastPeriod[] } };

type NwsHourlyPeriod = {
  startTime: string;
  temperature: number;
  icon: string;
  shortForecast: string;
};
type NwsHourlyForecast = { properties: { periods: NwsHourlyPeriod[] } };

type NwsAlertFeature = {
  properties: {
    event: string;
    senderName: string;
    description: string;
    onset: string | null;
    effective: string | null;
    ends: string | null;
    expires: string | null;
    severity: string;
  };
};
type NwsAlerts = { features: NwsAlertFeature[] };

/**
 * Fetches and parses a weather.gov (geo+json) endpoint.
 * @param url - The full weather.gov URL to request.
 * @returns The parsed JSON body.
 * @throws When the API responds with a non-ok status.
 */
async function fetchGeoJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`weather.gov error: ${response.status} for ${url}`);
  }
  const data: T = await response.json();
  return data;
}

function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621_371);
}

function buildCurrentTemps(
  props: NwsObservation['properties'] | undefined,
  fallbackTemp: number
): { temp: number; feelsLike: number } {
  const rawTempC = props?.temperature?.value ?? null;
  const rawFeelsC =
    props?.heatIndex?.value ?? props?.windChill?.value ?? rawTempC;
  const temp = rawTempC === null ? fallbackTemp : celsiusToFahrenheit(rawTempC);
  const feelsLike = rawFeelsC === null ? temp : celsiusToFahrenheit(rawFeelsC);
  return { temp, feelsLike };
}

function buildCurrent(
  observation: NwsObservation | null,
  currentHourly: NwsHourlyPeriod | undefined
): Weather['current'] {
  const props = observation?.properties;
  const { temp, feelsLike } = buildCurrentTemps(
    props,
    currentHourly?.temperature ?? 0
  );
  const windKmh = props?.windSpeed?.value ?? null;

  return {
    temp,
    feelsLike,
    humidity: props?.relativeHumidity?.value ?? 0,
    windSpeed: windKmh === null ? 0 : kmhToMph(windKmh),
    description: props?.textDescription ?? currentHourly?.shortForecast ?? '',
    icon: props?.icon ?? currentHourly?.icon ?? '',
  };
}

type DayGroup = { date: string; periods: NwsForecastPeriod[] };

function groupPeriodsByDate(periods: NwsForecastPeriod[]): DayGroup[] {
  const map = new Map<string, NwsForecastPeriod[]>();
  for (const period of periods) {
    const date = period.startTime.slice(0, 10);
    const existing = map.get(date);
    if (existing) {
      existing.push(period);
    } else {
      map.set(date, [period]);
    }
  }
  return [...map.entries()].map(([date, dayPeriods]) => ({
    date,
    periods: dayPeriods,
  }));
}

function buildDailyEntry(group: DayGroup): Weather['daily'][number] {
  const temps = group.periods.map((p) => p.temperature);
  const pops = group.periods.map(
    (p) => p.probabilityOfPrecipitation?.value ?? 0
  );
  const period = group.periods.find((p) => p.isDaytime) ?? group.periods[0];
  if (!period) {
    throw new Error(`Empty forecast period group for date ${group.date}`);
  }

  return {
    dt: Math.floor(Date.parse(period.startTime) / 1000),
    min: Math.min(...temps),
    max: Math.max(...temps),
    pop: Math.max(...pops) / 100,
    description: period.shortForecast,
    icon: period.icon,
  };
}

function toUnixSeconds(dateString: string | null): number {
  return dateString === null
    ? Math.floor(Date.now() / 1000)
    : Math.floor(Date.parse(dateString) / 1000);
}

function buildAlert(feature: NwsAlertFeature): WeatherAlert {
  const props = feature.properties;
  return {
    event: props.event,
    sender: props.senderName,
    start: toUnixSeconds(props.onset ?? props.effective),
    end: toUnixSeconds(props.ends ?? props.expires),
    description: props.description,
    tier: alertTier(props.severity),
  };
}

/**
 * Fetches current conditions, forecast, and active alerts for a coordinate
 * from weather.gov (NOAA). US coverage only.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns The mapped weather data.
 * @throws When any required weather.gov call fails.
 */
export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const point = await fetchGeoJson<NwsPoint>(
    `https://api.weather.gov/points/${lat},${lon}`
  );
  const { forecast, forecastHourly, observationStations } = point.properties;

  const stations = await fetchGeoJson<NwsStations>(observationStations);
  const stationId = stations.features[0]?.properties.stationIdentifier;
  const observation = stationId
    ? await fetchGeoJson<NwsObservation>(
        `https://api.weather.gov/stations/${stationId}/observations/latest`
      )
    : null;

  const forecastData = await fetchGeoJson<NwsForecast>(forecast);
  const hourlyData = await fetchGeoJson<NwsHourlyForecast>(forecastHourly);
  const alertsData = await fetchGeoJson<NwsAlerts>(
    `${ALERTS_URL}?point=${lat},${lon}`
  );

  const hourlyPeriods = hourlyData.properties.periods.slice(0, 12);
  const dayGroups = groupPeriodsByDate(forecastData.properties.periods).slice(
    0,
    7
  );
  const daily = dayGroups.map(buildDailyEntry);
  const [today] = daily;

  return {
    current: buildCurrent(observation, hourlyPeriods[0]),
    today: { min: today?.min ?? 0, max: today?.max ?? 0 },
    hourly: hourlyPeriods.map((p) => ({
      dt: Math.floor(Date.parse(p.startTime) / 1000),
      temp: p.temperature,
      icon: p.icon,
    })),
    daily,
    alerts: alertsData.features.map(buildAlert),
  };
}

type OpenMeteoResult = {
  latitude: number;
  longitude: number;
  name: string;
  admin1?: string;
  country_code?: string;
};
type OpenMeteoResponse = { results?: OpenMeteoResult[] };

/**
 * Geocodes a free-text city query using Open-Meteo's free geocoding API.
 * @param query - City name or place query.
 * @returns The first match, or null when nothing matches.
 * @throws When the API responds with a non-ok status.
 */
export async function geocodeCity(query: string): Promise<GeoResult | null> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set('name', query);
  url.searchParams.set('count', '1');

  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Geocoding error: ${response.status}`);
  }
  const data: OpenMeteoResponse = await response.json();
  const [first] = data.results ?? [];
  if (!first) {
    return null;
  }
  return {
    lat: first.latitude,
    lon: first.longitude,
    label: [first.name, first.admin1 ?? first.country_code]
      .filter(Boolean)
      .join(', '),
  };
}
