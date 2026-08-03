import { NextResponse } from 'next/server';
import { Env } from '@/libs/Env';
import { refreshAllFeeds } from '@/libs/news';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${Env.CRON_SECRET ?? ''}`;

  if (!Env.CRON_SECRET || auth !== expected) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const result = await refreshAllFeeds();
  return NextResponse.json(result);
}
