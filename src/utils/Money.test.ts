import { describe, expect, it } from 'vitest';
import { formatUsd } from './Money';

describe('formatUsd', () => {
  it('formats whole dollars', () => {
    expect(formatUsd(2500)).toBe('$25.00');
  });

  it('formats sub-dollar amounts', () => {
    expect(formatUsd(50)).toBe('$0.50');
  });

  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('formats negative amounts', () => {
    expect(formatUsd(-50)).toBe('-$0.50');
  });

  it('adds a thousands separator', () => {
    expect(formatUsd(123_456)).toBe('$1,234.56');
  });
});
