import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyStripeSignature } from './stripeWebhook';

const SECRET = 'whsec_test_secret';
const BODY = '{"id":"evt_1","type":"checkout.session.completed"}';

function sign(body: string, timestamp: number, secret = SECRET): string {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('verifyStripeSignature', () => {
  it('accepts a correctly signed recent payload', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeSignature({
        body: BODY,
        header: sign(BODY, now),
        secret: SECRET,
        nowSeconds: now,
      })
    ).toBe(true);
  });

  it('rejects a payload signed with the wrong secret', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeSignature({
        body: BODY,
        header: sign(BODY, now, 'whsec_wrong'),
        secret: SECRET,
        nowSeconds: now,
      })
    ).toBe(false);
  });

  it('rejects a tampered body', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeSignature({
        body: '{"id":"evt_evil"}',
        header: sign(BODY, now),
        secret: SECRET,
        nowSeconds: now,
      })
    ).toBe(false);
  });

  it('rejects a timestamp older than the tolerance', () => {
    const now = Math.floor(Date.now() / 1000);
    const old = now - 600;
    expect(
      verifyStripeSignature({
        body: BODY,
        header: sign(BODY, old),
        secret: SECRET,
        nowSeconds: now,
      })
    ).toBe(false);
  });

  it('rejects a malformed header', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeSignature({
        body: BODY,
        header: 'garbage',
        secret: SECRET,
        nowSeconds: now,
      })
    ).toBe(false);
  });

  it('rejects a null header', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeSignature({
        body: BODY,
        header: null,
        secret: SECRET,
        nowSeconds: now,
      })
    ).toBe(false);
  });

  it('rejects an empty secret', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeSignature({
        body: BODY,
        header: sign(BODY, now),
        secret: '',
        nowSeconds: now,
      })
    ).toBe(false);
  });
});
