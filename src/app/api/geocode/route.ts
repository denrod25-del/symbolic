import { NextResponse } from 'next/server';
import { geocodeCity } from '@/libs/weather';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  try {
    const result = await geocodeCity(q);
    if (!result) {
      return new NextResponse('Not Found', { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return new NextResponse('Geocoding unavailable', { status: 502 });
  }
}
