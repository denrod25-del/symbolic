import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Tolerance window, in seconds, for how old a Stripe webhook timestamp may
 * be before it is rejected as a possible replay attack.
 */
const TOLERANCE_SECONDS = 300;

/** Input required to verify a Stripe webhook signature. */
export type VerifyInput = {
  body: string;
  header: string | null;
  secret: string;
  nowSeconds: number;
};

type ParsedSignatureHeader = {
  timestamp: number;
  signatures: string[];
};

/**
 * Parses a Stripe `Stripe-Signature` header into its timestamp and the set
 * of `v1` signatures it carries.
 *
 * @param header - The raw `Stripe-Signature` header value.
 * @returns The parsed timestamp and `v1` signatures, or `null` if the header
 * is malformed (unparsable/non-finite timestamp, or no `v1` entries).
 */
function parseSignatureHeader(header: string): ParsedSignatureHeader | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    if (key === 't' && value !== undefined) {
      timestamp = Number(value);
    } else if (key === 'v1' && value !== undefined) {
      signatures.push(value);
    }
  }

  if (timestamp === null || !Number.isFinite(timestamp)) {
    return null;
  }
  if (signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

/**
 * Compares two hex-encoded digests in constant time, treating any mismatch
 * in length (including a zero-length candidate) as no match rather than
 * throwing.
 *
 * @param expectedHex - The hex-encoded digest computed from the payload.
 * @param candidateHex - A hex-encoded digest parsed from the request header.
 * @returns `true` when the digests represent the same bytes.
 */
function matchesDigest(expectedHex: string, candidateHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const candidate = Buffer.from(candidateHex, 'hex');

  if (candidate.length === 0 || candidate.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(expected, candidate);
}

/**
 * Verifies a Stripe webhook request against its `Stripe-Signature` header.
 *
 * Validates that at least one `v1` signature in the header matches an
 * HMAC-SHA256 digest of `{timestamp}.{body}` keyed by the endpoint's signing
 * secret, and that the signed timestamp is within the replay tolerance
 * window of the current time.
 *
 * @param input - The raw body, signature header, signing secret, and the
 * current time (in seconds) to check the timestamp against.
 * @returns `true` if the request is authentically from Stripe and recent
 * enough to accept; `false` otherwise.
 */
export function verifyStripeSignature(input: VerifyInput): boolean {
  const { body, header, secret, nowSeconds } = input;

  if (!secret || !header) {
    return false;
  }

  const parsed = parseSignatureHeader(header);
  if (!parsed) {
    return false;
  }

  const { timestamp, signatures } = parsed;
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) {
    return false;
  }

  const expectedDigest = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  return signatures.some((signature) =>
    matchesDigest(expectedDigest, signature)
  );
}
