// @vitest-environment node
// @polsia:user-owned — focused coverage for deterministic local anomaly scoring.
import { describe, expect, it } from 'vitest';

const { MINIMUM_BASELINE_LINES, normalizeLineTemplate, scoreAnomalies } = await import(
  '../../cli/logsift.mjs'
);

describe('local anomaly baseline scoring', () => {
  it('normalizes dynamic values into one deterministic line template', () => {
    expect(
      normalizeLineTemplate('INFO 2026-10-02T12:34:56Z request id=123 from 10.0.0.8'),
    ).toBe('info <timestamp> request id=<number> from <ip>');
    expect(normalizeLineTemplate('Request 550e8400-e29b-41d4-a716-446655440000')).toBe(
      'request <uuid>',
    );
  });

  it('gives common templates a lower score than a rare template', () => {
    const lines = [
      'INFO request id=100',
      'INFO request id=101',
      'INFO request id=102',
      'INFO request id=103',
      'INFO request id=104',
      'Unexpected parser state at worker startup',
    ];
    const results = scoreAnomalies(lines);

    expect(results[0]?.status).toBe('scored');
    expect(results[0]?.score).toBeLessThan(results[5]?.score ?? 0);
    expect(results[5]?.score).toBe(1);
    expect(results[5]?.inputs).toMatchObject({
      baselineSize: 5,
      templateSupport: 0,
      minimumBaseline: MINIMUM_BASELINE_LINES,
      leaveOneOut: true,
    });
    expect(results[5]?.explanation).toContain('0 supporting line');
    expect(results[5]?.limitations.length).toBeGreaterThan(0);
  });

  it('reports insufficient baseline without presenting a verdict', () => {
    const result = scoreAnomalies(['INFO start', 'INFO stop', 'INFO done'])[0];

    expect(result).toMatchObject({
      score: 0,
      confidence: 0,
      status: 'insufficient_baseline',
    });
    expect(result?.limitations.join(' ')).toContain('required before rarity is scored');
  });

  it('is deterministic and returns the documented evidence shape', () => {
    const lines = ['alpha 1', 'alpha 2', 'beta 3', 'gamma 4', 'delta 5', 'epsilon 6'];
    const first = scoreAnomalies(lines);
    const second = scoreAnomalies(lines);

    expect(first).toEqual(second);
    expect(Object.keys(first[0] ?? {}).sort()).toEqual([
      'confidence',
      'explanation',
      'inputs',
      'limitations',
      'score',
      'status',
    ]);
  });
});
