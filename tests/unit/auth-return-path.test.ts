// @polsia:user-owned — validates safe post-authentication navigation targets.
import { describe, expect, it } from 'vitest';
import { getSafeReturnPath } from '@/lib/business/auth-return-path';

describe('authentication return paths', () => {
  it('accepts a local path with its query and hash', () => {
    expect(getSafeReturnPath('/admin/pages')).toBe('/admin/pages');
    expect(getSafeReturnPath('/settings?tab=profile#email')).toBe('/settings?tab=profile#email');
  });

  it('falls back to the home page when the destination is missing or not a single string', () => {
    expect(getSafeReturnPath(undefined)).toBe('/');
    expect(getSafeReturnPath(null)).toBe('/');
    expect(getSafeReturnPath('')).toBe('/');
    expect(getSafeReturnPath(['/admin/pages'])).toBe('/');
  });

  it('rejects external, protocol-relative, and malformed destinations', () => {
    expect(getSafeReturnPath('https://evil.example/path')).toBe('/');
    expect(getSafeReturnPath('//evil.example/path')).toBe('/');
    expect(getSafeReturnPath('/\\\\evil.example/path')).toBe('/');
    expect(getSafeReturnPath('http://[')).toBe('/');
    expect(getSafeReturnPath('/admin\n//evil.example')).toBe('/');
  });
});
