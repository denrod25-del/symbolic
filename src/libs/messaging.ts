import type { CrmMessageChannel } from '@/utils/Crm';
import { Env } from './Env';

export type SendMessageInput = {
  channel: CrmMessageChannel;
  to: string;
  subject: string | null;
  body: string;
};

export type SendMessageResult = {
  status: 'sent' | 'failed';
  providerId: string | null;
};

/** Pluggable transport for a single channel (email or SMS). */
type MessageProvider = {
  readonly name: string;
  send: (input: SendMessageInput) => Promise<SendMessageResult>;
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

/** Records messages without contacting a provider; used when no keys are set. */
const stubProvider: MessageProvider = {
  name: 'stub',
  // eslint-disable-next-line require-await -- nothing to await in the simulated path
  send: async (_input) => ({
    status: 'sent',
    providerId: `stub_${Date.now()}`,
  }),
};

const resendProvider: MessageProvider = {
  name: 'resend',
  send: async (input) => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Env.RESEND_FROM_EMAIL,
        to: input.to,
        subject: input.subject ?? '(no subject)',
        text: input.body,
      }),
    });

    if (!response.ok) {
      return { status: 'failed', providerId: null };
    }

    const data: unknown = await response.json();
    return { status: 'sent', providerId: readString(data, 'id') };
  },
};

const twilioProvider: MessageProvider = {
  name: 'twilio',
  send: async (input) => {
    const credentials = `${Env.TWILIO_ACCOUNT_SID}:${Env.TWILIO_AUTH_TOKEN}`;
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${Env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: input.to,
          From: Env.TWILIO_FROM_NUMBER ?? '',
          Body: input.body,
        }).toString(),
      }
    );

    if (!response.ok) {
      return { status: 'failed', providerId: null };
    }

    const data: unknown = await response.json();
    return { status: 'sent', providerId: readString(data, 'sid') };
  },
};

/**
 * Picks the configured provider for a channel, falling back to the stub when
 * the channel's credentials are not set.
 * @param channel - The message channel to resolve a provider for.
 * @returns The provider to use.
 */
function resolveProvider(channel: CrmMessageChannel): MessageProvider {
  if (channel === 'email') {
    return Env.RESEND_API_KEY && Env.RESEND_FROM_EMAIL
      ? resendProvider
      : stubProvider;
  }
  return Env.TWILIO_ACCOUNT_SID &&
    Env.TWILIO_AUTH_TOKEN &&
    Env.TWILIO_FROM_NUMBER
    ? twilioProvider
    : stubProvider;
}

/**
 * Sends a message over the appropriate provider for its channel. Network or
 * provider errors resolve to a failed result rather than throwing.
 * @param input - The recipient and content to send.
 * @returns The delivery status and provider reference.
 */
export async function dispatchMessage(
  input: SendMessageInput
): Promise<SendMessageResult> {
  const provider = resolveProvider(input.channel);
  try {
    return await provider.send(input);
  } catch {
    return { status: 'failed', providerId: null };
  }
}
