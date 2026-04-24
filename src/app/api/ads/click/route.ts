import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { adClicks, ads } from '@/models/Schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  const query = searchParams.get('q') ?? '';

  const id = Number(idParam);
  if (!idParam || !Number.isInteger(id) || id <= 0) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const [ad] = await db.select().from(ads).where(eq(ads.id, id)).limit(1);

  if (!ad || !ad.active) {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    await db.insert(adClicks).values({ adId: ad.id, query });
  } catch {
    // Best-effort: record the click if possible, but don't block the redirect
  }

  return new NextResponse(null, {
    status: 307,
    headers: { Location: ad.url },
  });
}
