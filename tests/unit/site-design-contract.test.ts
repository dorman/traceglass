// @polsia:user-owned — contract regression coverage for the safe site appearance settings.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SITE_DESIGN,
  resolveSiteDesign,
  SiteDesignResponse,
  SiteDesignSchema,
} from '@/lib/contracts/site-design';

describe('site design contract', () => {
  it('provides the current TraceGlass palette and supported typography presets', () => {
    expect(SiteDesignSchema.parse(DEFAULT_SITE_DESIGN)).toEqual(DEFAULT_SITE_DESIGN);
    expect(DEFAULT_SITE_DESIGN).toMatchObject({
      colors: { background: '#090D0B', primary: '#55A77C' },
      typography: { displayFont: 'space-mono', bodyFont: 'ibm-plex-sans' },
      radius: 'sharp',
      cardTreatment: 'terminal',
      buttonTreatment: 'terminal',
    });
    expect(SiteDesignResponse.parse({ design: DEFAULT_SITE_DESIGN, updatedAt: null })).toEqual({
      design: DEFAULT_SITE_DESIGN,
      updatedAt: null,
    });
  });

  it('uses the current appearance defaults when the singleton row is missing or invalid', () => {
    expect(resolveSiteDesign(undefined)).toEqual(DEFAULT_SITE_DESIGN);
    expect(resolveSiteDesign(null)).toEqual(DEFAULT_SITE_DESIGN);
    expect(resolveSiteDesign({ version: 1, colors: { primary: 'red' } })).toEqual(
      DEFAULT_SITE_DESIGN,
    );
  });

  it('accepts explicit hex colors and fixed appearance presets', () => {
    const candidate = {
      ...DEFAULT_SITE_DESIGN,
      colors: { ...DEFAULT_SITE_DESIGN.colors, primary: '#c24a77' },
      typography: { displayFont: 'system', bodyFont: 'space-mono' },
      radius: 'rounded',
      cardTreatment: 'outlined',
      buttonTreatment: 'soft',
    };

    expect(SiteDesignSchema.parse(candidate)).toEqual(candidate);
  });

  it('rejects malformed colors, arbitrary CSS, fonts, and component styles', () => {
    for (const primary of ['green', '#abc', 'rgb(1, 2, 3)', 'url(javascript:alert(1))', 'red;position:fixed']) {
      expect(SiteDesignSchema.safeParse({
        ...DEFAULT_SITE_DESIGN,
        colors: { ...DEFAULT_SITE_DESIGN.colors, primary },
      }).success).toBe(false);
    }

    expect(SiteDesignSchema.safeParse({
      ...DEFAULT_SITE_DESIGN,
      typography: { displayFont: 'https://fonts.example.test/x.css', bodyFont: 'system' },
    }).success).toBe(false);
    expect(SiteDesignSchema.safeParse({ ...DEFAULT_SITE_DESIGN, cardTreatment: 'arbitrary-class' }).success).toBe(false);
    expect(SiteDesignSchema.safeParse({ ...DEFAULT_SITE_DESIGN, buttonTreatment: 'url(data:text/css)' }).success).toBe(false);
    expect(SiteDesignSchema.safeParse({ ...DEFAULT_SITE_DESIGN, customCss: 'body { display:none }' }).success).toBe(false);
  });
});
