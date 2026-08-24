const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/**
 * Formats an integer cent amount as a USD string.
 * @param cents - The amount in whole cents; may be negative.
 * @returns The formatted amount, e.g. `$25.00`.
 */
export function formatUsd(cents: number): string {
  return usdFormatter.format(cents / 100);
}
