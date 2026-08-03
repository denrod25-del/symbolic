import { NextResponse } from 'next/server';
import type { Weather } from '@/libs/weather';
import { fetchWeather } from '@/libs/weather';

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { data: Weather; expires: number }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  // ~1km cells so nearby visitors share a cache entry.
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return NextResponse.json(hit.data);
  }

  try {
    const data = await fetchWeather(lat, lon);
    cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(data);
  } catch {
    return new NextResponse('Weather unavailable', { status: 502 });
  }
}
