import type { CrmQuoteLineItem } from '@/utils/Crm';
import { Env } from './Env';

export type EstimateInput = {
  prompt: string;
};

export type EstimateResult =
  | { status: 'generated'; lineItems: CrmQuoteLineItem[] }
  | { status: 'failed' };

/** Pluggable source of AI-suggested quote line items. */
type EstimatorProvider = {
  readonly name: string;
  estimate: (input: EstimateInput) => Promise<EstimateResult>;
};

/** Anthropic model used to draft estimates. */
const ESTIMATOR_MODEL = 'claude-opus-4-8';

/** Tool the model must call so line items come back as structured JSON. */
const ESTIMATOR_TOOL = {
  name: 'propose_line_items',
  description:
    'Return the line items that make up a price estimate for the described job.',
  input_schema: {
    type: 'object',
    properties: {
      lineItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Short description of the work or material',
            },
            quantity: {
              type: 'number',
              description: 'Quantity, often 1',
            },
            unitPrice: {
              type: 'number',
              description: 'Price per unit in GBP pounds',
            },
          },
          required: ['description', 'quantity', 'unitPrice'],
        },
      },
    },
    required: ['lineItems'],
  },
} as const;

const ESTIMATOR_SYSTEM =
  'You are an estimator for home-service businesses. Given a job description, ' +
  'produce a concise, realistic price estimate as line items priced in GBP. ' +
  'Prefer two to six line items covering labour and materials.';

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
 * Narrows a raw model line item into a stored line item priced in pence.
 * @param raw - A single line item from the model's tool input.
 * @returns The stored line item, or null when the shape is invalid.
 */
function toStoredLineItem(raw: unknown): CrmQuoteLineItem | null {
  const description = readProperty(raw, 'description');
  const quantity = readProperty(raw, 'quantity');
  const unitPrice = readProperty(raw, 'unitPrice');

  if (
    typeof description !== 'string' ||
    typeof quantity !== 'number' ||
    typeof unitPrice !== 'number'
  ) {
    return null;
  }

  return {
    description,
    quantity,
    unitPrice: Math.round(unitPrice * 100),
  };
}

/**
 * Extracts proposed line items from an Anthropic Messages API response.
 * @param data - The parsed response body.
 * @returns The stored line items, or null when none could be read.
 */
function extractLineItems(data: unknown): CrmQuoteLineItem[] | null {
  const content = readProperty(data, 'content');
  if (!Array.isArray(content)) {
    return null;
  }

  for (const block of content) {
    if (readProperty(block, 'type') !== 'tool_use') {
      continue;
    }
    const items = readProperty(readProperty(block, 'input'), 'lineItems');
    if (!Array.isArray(items)) {
      return null;
    }
    const lineItems = items
      .map(toStoredLineItem)
      .filter((item): item is CrmQuoteLineItem => item !== null);
    return lineItems.length > 0 ? lineItems : null;
  }

  return null;
}

/** Returns a simple heuristic estimate without calling a model. */
const stubProvider: EstimatorProvider = {
  name: 'stub',
  // eslint-disable-next-line require-await -- nothing to await in the simulated path
  estimate: async (input) => ({
    status: 'generated',
    lineItems: [
      {
        description: `Assessment — ${input.prompt}`.slice(0, 120),
        quantity: 1,
        unitPrice: 5000,
      },
      { description: 'Labour', quantity: 2, unitPrice: 4500 },
      { description: 'Materials', quantity: 1, unitPrice: 3000 },
    ],
  }),
};

const anthropicProvider: EstimatorProvider = {
  name: 'anthropic',
  estimate: async (input) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ESTIMATOR_MODEL,
        max_tokens: 1024,
        system: ESTIMATOR_SYSTEM,
        tools: [ESTIMATOR_TOOL],
        tool_choice: { type: 'tool', name: ESTIMATOR_TOOL.name },
        messages: [{ role: 'user', content: input.prompt }],
      }),
    });

    if (!response.ok) {
      return { status: 'failed' };
    }

    const data: unknown = await response.json();
    const lineItems = extractLineItems(data);
    if (!lineItems) {
      return { status: 'failed' };
    }

    return { status: 'generated', lineItems };
  },
};

/**
 * Picks the configured estimator, falling back to the simulated stub when no
 * Anthropic key is set.
 * @returns The provider to use.
 */
function resolveProvider(): EstimatorProvider {
  return Env.ANTHROPIC_API_KEY ? anthropicProvider : stubProvider;
}

/**
 * Drafts quote line items from a job description. Network or provider errors
 * resolve to a failed result rather than throwing.
 * @param input - The job description to estimate.
 * @returns The suggested line items, or a failed result.
 */
export async function generateEstimate(
  input: EstimateInput
): Promise<EstimateResult> {
  const provider = resolveProvider();
  try {
    return await provider.estimate(input);
  } catch {
    return { status: 'failed' };
  }
}
