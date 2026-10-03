// @polsia:user-owned — safe shared appearance contract for public and owner APIs.
import { z } from 'zod';

export const SiteDesignSchema = z
  .object({
    version: z.literal(1),
    colors: z
      .object({
        primary: z.string().regex(/^#[\da-fA-F]{6}$/),
        accent: z.string().regex(/^#[\da-fA-F]{6}$/),
        background: z.string().regex(/^#[\da-fA-F]{6}$/),
        surface: z.string().regex(/^#[\da-fA-F]{6}$/),
        text: z.string().regex(/^#[\da-fA-F]{6}$/),
        mutedText: z.string().regex(/^#[\da-fA-F]{6}$/),
        border: z.string().regex(/^#[\da-fA-F]{6}$/),
      })
      .strict(),
    typography: z
      .object({
        displayFont: z.enum(['space-mono', 'ibm-plex-sans', 'system']),
        bodyFont: z.enum(['space-mono', 'ibm-plex-sans', 'system']),
      })
      .strict(),
    radius: z.enum(['sharp', 'soft', 'rounded']),
    cardTreatment: z.enum(['terminal', 'outlined', 'soft']),
    buttonTreatment: z.enum(['terminal', 'outlined', 'soft']),
  })
  .strict();

export const SiteDesignResponse = z
  .object({
    design: SiteDesignSchema,
    updatedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const SITE_DESIGN_SINGLETON_ID = 'public-site';

export type SiteDesign = z.infer<typeof SiteDesignSchema>;
export type SiteDesignResponse = z.infer<typeof SiteDesignResponse>;

export const DEFAULT_SITE_DESIGN: SiteDesign = SiteDesignSchema.parse({
  version: 1,
  colors: {
    primary: '#55A77C',
    accent: '#86A58F',
    background: '#090D0B',
    surface: '#141B17',
    text: '#E7EEE9',
    mutedText: '#9AA79E',
    border: '#2B3930',
  },
  typography: { displayFont: 'space-mono', bodyFont: 'ibm-plex-sans' },
  radius: 'sharp',
  cardTreatment: 'terminal',
  buttonTreatment: 'terminal',
});

const fontStacks = {
  'space-mono': '"Space Mono", "IBM Plex Mono", ui-monospace, monospace',
  'ibm-plex-sans': '"IBM Plex Sans", "Helvetica Neue", sans-serif',
  system: 'ui-sans-serif, system-ui, sans-serif',
} as const;

const radiusValues = { sharp: '0.25rem', soft: '0.5rem', rounded: '0.75rem' } as const;

export function siteDesignCssVariables(design: SiteDesign): Record<string, string> {
  return {
    '--site-primary': design.colors.primary,
    '--site-accent': design.colors.accent,
    '--site-background': design.colors.background,
    '--site-surface': design.colors.surface,
    '--site-text': design.colors.text,
    '--site-muted-text': design.colors.mutedText,
    '--site-border': design.colors.border,
    '--background': design.colors.background,
    '--foreground': design.colors.text,
    '--card': design.colors.surface,
    '--card-foreground': design.colors.text,
    '--popover': design.colors.surface,
    '--popover-foreground': design.colors.text,
    '--primary': design.colors.primary,
    '--primary-foreground': design.colors.background,
    '--secondary': design.colors.surface,
    '--secondary-foreground': design.colors.text,
    '--muted': design.colors.surface,
    '--muted-foreground': design.colors.mutedText,
    '--accent': design.colors.accent,
    '--accent-foreground': design.colors.background,
    '--border': design.colors.border,
    '--input': design.colors.border,
    '--ring': design.colors.primary,
    '--font-display': fontStacks[design.typography.displayFont],
    '--font-body': fontStacks[design.typography.bodyFont],
    '--radius': radiusValues[design.radius],
  };
}

export function resolveSiteDesign(settings: unknown): SiteDesign {
  const parsed = SiteDesignSchema.safeParse(settings);
  return parsed.success ? parsed.data : DEFAULT_SITE_DESIGN;
}
