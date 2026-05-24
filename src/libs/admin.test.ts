import { describe, expect, it } from 'vitest';
import { isAdminEmail } from './admin';

// The test suite runs with ADMIN_EMAILS=admin@symbolic.test (from .env).

describe('admin', () => {
  describe('isAdminEmail', () => {
    it('returns true for an allowlisted email', () => {
      expect(isAdminEmail('admin@symbolic.test')).toBe(true);
    });

    it('matches case-insensitively', () => {
      expect(isAdminEmail('ADMIN@Symbolic.Test')).toBe(true);
    });

    it('returns false for a non-listed email', () => {
      expect(isAdminEmail('nobody@example.com')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(isAdminEmail('')).toBe(false);
    });

    it('returns false for null or undefined', () => {
      expect(isAdminEmail(null)).toBe(false);
      const undef: string | undefined = undefined;
      expect(isAdminEmail(undef)).toBe(false);
    });
  });
});
