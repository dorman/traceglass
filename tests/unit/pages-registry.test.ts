import { describe, expect, it } from 'vitest';
import { existingMarketingPages, findExistingMarketingPage } from '@/lib/marketing-page-registry';

describe('existing marketing page registry', () => {
  it('contains stable identities for every existing public route', () => {
    expect(existingMarketingPages.map((page) => page.sourcePath)).toEqual([
      '/',
      '/install',
      '/release',
      '/signatures',
      '/waitlist',
    ]);
    expect(new Set(existingMarketingPages.map((page) => page.id)).size).toBe(5);
  });

  it('resolves source keys and canonical paths without exposing draft state', () => {
    expect(findExistingMarketingPage('home')?.sourcePath).toBe('/');
    expect(findExistingMarketingPage('/billing')).toBeUndefined();
    expect(findExistingMarketingPage('billing')).toBeUndefined();
    expect(existingMarketingPages.every((page) => page.body.length > 0)).toBe(true);
    expect(existingMarketingPages.every((page) => page.content.version === 1)).toBe(true);
    expect(existingMarketingPages.every((page) => page.content.sections.length > 0)).toBe(true);
  });
});
