import type { CrmQuoteLineItem } from '@/utils/Crm';
import { quoteLineItemsTotal } from '@/utils/Crm';
import { Env } from './Env';

export type CreatePaymentLinkInput = {
  invoiceId: number;
  title: string;
  currency: string;
  lineItems: CrmQuoteLineItem[];
};

export type CreatePaymentLinkResult =
  | { status: 'created'; url: string; providerId: string | null }
  | { status: 'failed' };

/** Pluggable hosted-checkout provider for collecting invoice payments. */
type PaymentProvider = {
  readonly name: string;
  createLink: (
    input: CreatePaymentLinkInput
  ) => Promise<CreatePaymentLinkResult>;
};

/**
 * Reads a string property from an unknown value, e.g. a parsed JSON response.
 * @param value - The value to inspect.
 * @param key - The property name to read.
 * @returns The string value, or null when absent or non-string.
 */
function readString(value: unknown, key: string): string | null {
  if (value && typeof value === 'object') {
    const field: unknown = Reflect.get(value, key);
    return typeof field === 'string' ? field : null;
  }
  return null;
}

/**
 * Resolves the base URL for simulated links and Stripe redirect targets.
 * @returns The configured app URL, or the local default.
 */
function appBaseUrl(): string {
  return Env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

/** Returns a simulated checkout link without contacting a provider. */
const stubProvider: PaymentProvider = {
  name: 'stub',
  // eslint-disable-next-line require-await -- nothing to await in the simulated path
  createLink: async (input) => ({
    status: 'created',
    url: `${appBaseUrl()}/pay/simulated/${input.invoiceId}`,
    providerId: `stub_${Date.now()}`,
  }),
};

const stripeProvider: PaymentProvider = {
  name: 'stripe',
  createLink: async (input) => {
    const total = quoteLineItemsTotal(input.lineItems);
    const base = appBaseUrl();
    const response = await fetch(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          mode: 'payment',
          success_url: `${base}/crm/invoices?paid=${input.invoiceId}`,
          cancel_url: `${base}/crm/invoices`,
          'line_items[0][quantity]': '1',
          'line_items[0][price_data][currency]': input.currency,
          'line_items[0][price_data][unit_amount]': String(total),
          'line_items[0][price_data][product_data][name]': input.title,
        }).toString(),
      }
    );

    if (!response.ok) {
      return { status: 'failed' };
    }

    const data: unknown = await response.json();
    const url = readString(data, 'url');
    if (!url) {
      return { status: 'failed' };
    }

    return { status: 'created', url, providerId: readString(data, 'id') };
  },
};

/**
 * Picks the configured payment provider, falling back to the simulated stub
 * when no Stripe key is set.
 * @returns The provider to use.
 */
function resolveProvider(): PaymentProvider {
  return Env.STRIPE_SECRET_KEY ? stripeProvider : stubProvider;
}

/**
 * Creates a hosted checkout link for an invoice. Network or provider errors
 * resolve to a failed result rather than throwing.
 * @param input - The invoice details to charge for.
 * @returns The created link, or a failed result.
 */
export async function createPaymentLink(
  input: CreatePaymentLinkInput
): Promise<CreatePaymentLinkResult> {
  const provider = resolveProvider();
  try {
    return await provider.createLink(input);
  } catch {
    return { status: 'failed' };
  }
}
