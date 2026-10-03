import { describe, expect, it } from 'vitest';
import { isVerifiedPageOwner } from '@/lib/page-owner-policy';

describe('page owner policy', () => {
  it('allows the verified configured owner email case-insensitively', () => {
    expect(isVerifiedPageOwner(' Owner@Example.com ', true, 'owner@example.com')).toBe(true);
  });

  it('denies another signed-in user, missing configuration, and missing identity', () => {
    expect(isVerifiedPageOwner('member@example.com', true, 'owner@example.com')).toBe(false);
    expect(isVerifiedPageOwner('owner@example.com', true, undefined)).toBe(false);
    expect(isVerifiedPageOwner(undefined, true, 'owner@example.com')).toBe(false);
  });

  it('denies a matching owner email until the session identity is verified', () => {
    expect(isVerifiedPageOwner('owner@example.com', false, 'owner@example.com')).toBe(false);
    expect(isVerifiedPageOwner('owner@example.com', undefined, 'owner@example.com')).toBe(false);
  });
});
