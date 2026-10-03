// @vitest-environment node
import { describe, expect, it } from 'vitest';

const { parseWatchlist } = await import('../../cli/logsift.mjs');

describe('parseWatchlist()', () => {
  it('returns ok with the parsed shape for a valid watchlist', () => {
    const result = parseWatchlist(
      JSON.stringify({ critical: ['FATAL'], notice: ['INFO', 'ready'] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.critical.map((e) => e.keyword)).toEqual(['FATAL']);
    expect(result.value.notice.map((e) => e.keyword)).toEqual(['INFO', 'ready']);
    expect(result.value.critical[0]?.tier).toBe('critical');
    expect(result.value.notice[0]?.tier).toBe('notice');
  });

  it('accepts an empty object (no tier array defined)', () => {
    const result = parseWatchlist(JSON.stringify({}));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value)).toEqual([]);
  });

  it('accepts any tier name as a top-level key', () => {
    const result = parseWatchlist(JSON.stringify({ alert: ['P0'], trace: ['T0'] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.alert?.[0]?.tier).toBe('alert');
    expect(result.value.trace?.[0]?.tier).toBe('trace');
  });

  it('still accepts the legacy critical / info tier shape', () => {
    const result = parseWatchlist(JSON.stringify({ critical: ['FATAL'], info: ['ready'] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.critical.map((e) => e.keyword)).toEqual(['FATAL']);
    expect(result.value.info.map((e) => e.keyword)).toEqual(['ready']);
  });

  it('accepts an object entry with multi: true', () => {
    const result = parseWatchlist(
      JSON.stringify({
        critical: [{ keyword: 'ERROR', multi: true }],
        info: [],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.critical).toHaveLength(1);
    expect(result.value.critical[0]?.keyword).toBe('ERROR');
    expect(result.value.critical[0]?.multi).toBe(true);
    expect(result.value.critical[0]?.tier).toBe('critical');
  });

  it('accepts an object entry with a continuation regex', () => {
    const result = parseWatchlist(
      JSON.stringify({
        critical: [{ keyword: 'ERROR', continuation: '^\\s*at\\s' }],
        info: [],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.critical[0]?.keyword).toBe('ERROR');
    expect(result.value.critical[0]?.continuation).toBe('^\\s*at\\s');
  });

  it('honors a per-entry severity override on the parent tier', () => {
    const result = parseWatchlist(
      JSON.stringify({
        warning: [{ keyword: 'WARN', severity: 'critical' }],
        notice: [{ keyword: 'INFO' }],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warning[0]?.tier).toBe('critical');
    expect(result.value.warning[0]?.severity).toBe('critical');
    expect(result.value.notice[0]?.tier).toBe('notice');
  });

  it('rejects non-array values for tier arrays', () => {
    const result = parseWatchlist(JSON.stringify({ critical: 'FATAL', info: [] }));
    expect(result.ok).toBe(false);
  });

  it('rejects whitespace-only keywords', () => {
    const result = parseWatchlist(JSON.stringify({ critical: ['   '], info: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/whitespace/);
  });

  it('rejects object entries missing a keyword', () => {
    const result = parseWatchlist(JSON.stringify({ critical: [{ multi: true }], info: [] }));
    expect(result.ok).toBe(false);
  });

  it('returns an error for invalid JSON', () => {
    const result = parseWatchlist('not json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/invalid JSON/);
  });

  it('rejects when the JSON root is an array (must be a tier-keyed object)', () => {
    const result = parseWatchlist('["FATAL"]');
    expect(result.ok).toBe(false);
  });

  it('returns ok with shape for a watchlist using warning + critical tiers', () => {
    const result = parseWatchlist(
      JSON.stringify({ critical: ['FATAL'], warning: ['WARN'], notice: ['INFO'] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warning.map((e) => e.keyword)).toEqual(['WARN']);
    expect(result.value.notice.map((e) => e.keyword)).toEqual(['INFO']);
  });

  it('does not dedupe duplicate keywords', () => {
    const result = parseWatchlist(JSON.stringify({ critical: ['FATAL', 'FATAL'], info: [] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.critical.map((e) => e.keyword)).toEqual(['FATAL', 'FATAL']);
  });
});
