import { Env } from './Env';

export type ReplyMessage = {
  direction: string;
  body: string;
};

export type DraftReplyInput = {
  contactName: string;
  messages: ReplyMessage[];
};

export type DraftReplyResult =
  | { status: 'generated'; text: string }
  | { status: 'failed' };

/** Pluggable source of AI-drafted inbox replies. */
type ReplyProvider = {
  readonly name: string;
  draft: (input: DraftReplyInput) => Promise<DraftReplyResult>;
};

/** Anthropic model used to draft replies. */
const REPLY_MODEL = 'claude-opus-4-8';

const REPLY_SYSTEM =
  'You draft replies on behalf of a home-service business to its customers. ' +
  'Given the conversation so far, write a short, friendly, professional reply ' +
  'to the latest customer message. Return only the reply text, with no preamble ' +
  'or quotation.';

/**
 * Reads a property from an unknown value, e.g. a parsed JSON response.
 * @param value - The value to inspect.
 * @param key - The property name to read.
 * @returns The property value, or undefined when absent.
 */
function readProperty(value: unknown, key: string): unknown {
  if (value && typeof value === 'object') {
    return Reflect.get(value, key);
  }
  return undefined;
}

/**
 * Extracts the first non-empty text block from a Messages API response.
 * @param data - The parsed response body.
 * @returns The reply text, or null when none could be read.
 */
function extractText(data: unknown): string | null {
  const content = readProperty(data, 'content');
  if (!Array.isArray(content)) {
    return null;
  }
  for (const block of content) {
    if (readProperty(block, 'type') === 'text') {
      const text = readProperty(block, 'text');
      if (typeof text === 'string' && text.trim() !== '') {
        return text.trim();
      }
    }
  }
  return null;
}

/**
 * Renders the conversation as a plain-text transcript for the model.
 * @param input - The contact name and conversation messages.
 * @returns The transcript text.
 */
function transcript(input: DraftReplyInput): string {
  const lines = input.messages.map((message) => {
    const who = message.direction === 'inbound' ? 'Customer' : 'Business';
    return `${who}: ${message.body}`;
  });
  return `Conversation with ${input.contactName}:\n${lines.join('\n')}`;
}

/** Returns a generic reply without calling a model. */
const stubProvider: ReplyProvider = {
  name: 'stub',
  // eslint-disable-next-line require-await -- nothing to await in the simulated path
  draft: async (input) => {
    const firstName = input.contactName.split(' ')[0] ?? input.contactName;
    return {
      status: 'generated',
      text: `Hi ${firstName}, thanks for reaching out — happy to help. When would suit you for a quick call?`,
    };
  },
};

const anthropicProvider: ReplyProvider = {
  name: 'anthropic',
  draft: async (input) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: REPLY_MODEL,
        max_tokens: 512,
        system: REPLY_SYSTEM,
        messages: [{ role: 'user', content: transcript(input) }],
      }),
    });

    if (!response.ok) {
      return { status: 'failed' };
    }

    const data: unknown = await response.json();
    const text = extractText(data);
    return text ? { status: 'generated', text } : { status: 'failed' };
  },
};

/**
 * Picks the configured reply provider, falling back to the simulated stub when
 * no Anthropic key is set.
 * @returns The provider to use.
 */
function resolveProvider(): ReplyProvider {
  return Env.ANTHROPIC_API_KEY ? anthropicProvider : stubProvider;
}

/**
 * Drafts a reply to a conversation. Network or provider errors resolve to a
 * failed result rather than throwing.
 * @param input - The contact name and conversation messages.
 * @returns The drafted reply, or a failed result.
 */
export async function draftReply(
  input: DraftReplyInput
): Promise<DraftReplyResult> {
  const provider = resolveProvider();
  try {
    return await provider.draft(input);
  } catch {
    return { status: 'failed' };
  }
}
