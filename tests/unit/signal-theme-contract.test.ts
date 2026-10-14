import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SAMPLE_LOG_FADE_MS, SAMPLE_LOG_SCENE_MS, signalTheme } from '@/lib/signal-theme';

const themeRs = readFileSync('traceglass/src/theme.rs', 'utf8');

function expectSlot(label: string, hex: string) {
  const rgb = hex.replace('#', '');
  const r = Number.parseInt(rgb.slice(0, 2), 16);
  const g = Number.parseInt(rgb.slice(2, 4), 16);
  const b = Number.parseInt(rgb.slice(4, 6), 16);
  const needle = `Slot::new(0x${r.toString(16).padStart(2, '0').toUpperCase()}`;
  // theme.rs uses lowercase 0xHH with mixed case — match the decimal-ish form via bytes.
  const alt = `Slot::new(0x${r.toString(16).padStart(2, '0')}, 0x${g
    .toString(16)
    .padStart(2, '0')}, 0x${b.toString(16).padStart(2, '0')}`;
  expect(themeRs.toLowerCase(), `${label} ${hex} missing from theme.rs`).toContain(
    alt.toLowerCase(),
  );
  void needle;
}

describe('Signal theme contract', () => {
  it('keeps marketing hex tokens locked to theme.rs signal_dark slots', () => {
    expectSlot('bg', signalTheme.bg);
    expectSlot('surface', signalTheme.surface);
    expectSlot('accent', signalTheme.accent);
    expectSlot('secondary', signalTheme.secondary);
    expectSlot('matchFg', signalTheme.matchFg);
    expectSlot('cursorBg', signalTheme.cursorBg);
    expectSlot('levelInfo', signalTheme.levelInfo);
    expectSlot('levelWarn', signalTheme.levelWarn);
    expectSlot('levelError', signalTheme.levelError);
    expectSlot('sevCrit', signalTheme.sevCrit);
    expectSlot('sevHigh', signalTheme.sevHigh);
    expectSlot('sevMed', signalTheme.sevMed);

    expect(signalTheme.matchFg).toBe('#0B0F14');
    expect(signalTheme.accent).toBe('#3EE0D8');
    expect(signalTheme.secondary).toBe('#8B7CF6');
    expect(signalTheme.bg).toBe('#0F1117');
  });

  it('preserves sample-log animation timing constants', () => {
    expect(SAMPLE_LOG_SCENE_MS).toBe(4200);
    expect(SAMPLE_LOG_FADE_MS).toBe(280);
  });

  it('ships Signal chrome CSS with dashed frame and mode-pill ink', () => {
    const css = readFileSync('src/components/custom/signal-tui.css', 'utf8');
    expect(css).toContain('border: 1px dashed var(--signal-accent)');
    expect(css).toContain('--signal-match-fg: #0b0f14');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('.signal-tui__mode');
  });
});
