import { NextResponse } from 'next/server';

const SAMPLE_RECENT = [
  'privacy first browsers',
  'symbolic search engine',
  'best chromium alternatives',
  'brave search api',
  'next.js 16 release notes',
  'electron webview tutorial',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export function GET() {
  return NextResponse.json(
    { recent: SAMPLE_RECENT },
    { headers: CORS_HEADERS }
  );
}

export function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}
