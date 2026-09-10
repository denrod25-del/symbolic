import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { creditTopUp } from '@/libs/billing';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { verifyStripeSignature } from '@/libs/stripeWebhook';
import { advertisers } from '@/models/Schema';

type StripeSession = {
  id?: unknown;
  payment_status?: unknown;
  amount_total?: unknown;
  client_reference_id?: unknown;
};

type StripeEvent = {
  type?: unknown;
  data?: { object?: StripeSession };
};

export async function POST(request: Request) {
  // The RAW body is required: parsing and reserializing breaks the signature.
  const body = await request.text();

  const valid = verifyStripeSignature({
    body,
    header: request.headers.get('stripe-signature'),
    secret: Env.STRIPE_WEBHOOK_SECRET ?? '',
    nowSeconds: Math.floor(Date.now() / 1000),
  });

  if (!valid) {
    return new NextResponse('Invalid signature', { status: 400 });
  }

  let event: StripeEvent;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    event = JSON.parse(body) as StripeEvent;
  } catch {
    return new NextResponse('Bad payload', { status: 400 });
  }

  // Acknowledge anything we do not act on so Stripe stops retrying.
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data?.object;
  if (!session || session.payment_status !== 'paid') {
    return NextResponse.json({ received: true });
  }

  const sessionId = typeof session.id === 'string' ? session.id : null;
  const amountCents =
    typeof session.amount_total === 'number' ? session.amount_total : null;
  const advertiserId =
    typeof session.client_reference_id === 'string'
      ? Number(session.client_reference_id)
      : Number.NaN;

  if (!(sessionId && amountCents) || !Number.isInteger(advertiserId)) {
    return NextResponse.json({ received: true });
  }

  const [advertiser] = await db
    .select({ id: advertisers.id })
    .from(advertisers)
    .where(eq(advertisers.id, advertiserId))
    .limit(1);

  if (!advertiser) {
    return NextResponse.json({ received: true });
  }

  try {
    await creditTopUp({
      advertiserId,
      amountCents,
      stripeSessionId: sessionId,
    });
  } catch {
    // A concurrent replay of the same event lost the unique-constraint race.
    // The balance is already correct, so acknowledge rather than make Stripe retry.
  }

  return NextResponse.json({ received: true });
}
