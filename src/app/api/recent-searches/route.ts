import { NextResponse } from 'next/server';
import { recentSearches } from '@/libs/searches';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export const dynamic = 'force-dynamic';

export async function GET() {
  const recent = await recentSearches();
  return NextResponse.json({ recent }, { headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}
