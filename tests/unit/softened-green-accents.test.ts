import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brandVisual } from '@/lib/brand';

const css = readFileSync('src/app/globals.css', 'utf8');
const icon = readFileSync('src/app/icon.svg', 'utf8');

describe('softened TraceGlass green accents', () => {
  it('uses the muted seed for the shared visual ramp', () => {
    expect(css).toContain('--brand-c: 0.12');
    expect(css).toContain('--brand-l: 0.54');
    expect(brandVisual.themeColor).toBe('#158353');
  });

  it('does not ship the former neon green in the scoped visual surfaces', () => {
    expect(css.toLowerCase()).not.toContain('#00f5b8');
    expect(icon.toLowerCase()).not.toContain('#00f5b8');
    expect(icon).toContain('fill="#158353"');
  });
});
