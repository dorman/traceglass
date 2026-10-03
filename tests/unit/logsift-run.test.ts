// @vitest-environment node
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

const { run, parseWatchlist } = await import('../../cli/logsift.mjs');

const w = { critical: ['FATAL'], info: ['INFO', 'ready'] };

describe('run()', () => {
  it('returns exitCode 1 when a critical line is present', async () => {
    const input = ['INFO init', 'FATAL boom', 'INFO done'].join('\n');
    const result = await run({ input, watchlist: w });
    expect(result.exitCode).toBe(1);
    expect(result.counts.critical).toBe(1);
    expect(result.counts.info).toBe(2);
    expect(result.counts.anomalies).toBe(0);
    expect(result.counts.lines).toBe(3);
    expect(result.output).toContain('\x1b[31mFATAL\x1b[0m');
  });

  it('returns exitCode 0 when only info matches are present', async () => {
    const input = ['INFO a', 'INFO b', 'INFO c'].join('\n');
    const result = await run({ input, watchlist: w });
    expect(result.exitCode).toBe(0);
    expect(result.counts.critical).toBe(0);
    expect(result.counts.info).toBe(3);
  });

  it('returns zero counts for empty input', async () => {
    const result = await run({ input: '', watchlist: w });
    expect(result.exitCode).toBe(0);
    expect(result.counts.lines).toBe(0);
    expect(result.counts.anomalies).toBe(0);
  });

  it('reports unmatched lines without changing matched records or exit behavior', async () => {
    const input = ['INFO ready', 'unrecognized payload', 'FATAL boom', 'still unknown'].join('\n');
    const result = await run({ input, watchlist: w, file: 'app.log' });

    expect(result.exitCode).toBe(1);
    expect(result.counts.anomalies).toBe(2);
    expect(result.anomalies).toHaveLength(2);
    expect(result.anomalies[0]).toMatchObject({
      type: 'anomaly',
      file: 'app.log',
      line: 2,
      text: 'unrecognized payload',
      status: 'insufficient_baseline',
      score: 0,
      confidence: 0,
    });
    expect(result.anomalies[1]).toMatchObject({
      type: 'anomaly',
      file: 'app.log',
      line: 4,
      text: 'still unknown',
      status: 'insufficient_baseline',
      score: 0,
      confidence: 0,
    });
    expect(result.anomalies[0]?.limitations.length).toBeGreaterThan(0);
    expect(result.records).toEqual([
      { file: 'app.log', line: 1, severity: 'info', match: 'INFO', source: 'user_watchlist' },
      { file: 'app.log', line: 1, severity: 'info', match: 'ready', source: 'user_watchlist' },
      {
        file: 'app.log',
        line: 3,
        severity: 'critical',
        match: 'FATAL',
        source: 'user_watchlist',
      },
    ]);
  });

  it('reports every line as an anomaly when no signatures match', async () => {
    const result = await run({ input: 'one\ntwo\nthree\nfour', watchlist: {} });

    expect(result.exitCode).toBe(0);
    expect(result.counts.anomalies).toBe(4);
    expect(result.outputRecords).toHaveLength(4);
    expect(result.outputRecords.map((record) => ('type' in record ? record.type : 'match'))).toEqual([
      'anomaly',
      'anomaly',
      'anomaly',
      'anomaly',
    ]);
    expect(result.outputRecords.map((record) => record.line)).toEqual([1, 2, 3, 4]);
    expect(result.outputRecords.every((record) => 'type' in record && record.type === 'anomaly')).toBe(
      true,
    );
  });

  it('counts trailing lines without a final newline', async () => {
    const input = 'INFO no newline';
    const result = await run({ input, watchlist: w });
    expect(result.counts.lines).toBe(1);
    expect(result.exitCode).toBe(0);
  });

  it('does not double-count a trailing empty line from a final newline', async () => {
    const input = 'INFO ok\n';
    const result = await run({ input, watchlist: w });
    expect(result.counts.lines).toBe(1);
  });

  it('accepts a Readable stream as input', async () => {
    const stream = Readable.from(['INFO a\n', 'INFO b\n']);
    const result = await run({ input: stream, watchlist: w });
    expect(result.counts.lines).toBe(2);
    expect(result.counts.info).toBe(2);
    expect(result.exitCode).toBe(0);
  });

  it('does not treat empty stream chunks as lines', async () => {
    const stream = Readable.from(['INFO a\n', '']);
    const result = await run({ input: stream, watchlist: w });
    expect(result.counts.lines).toBe(1);
  });

  it('groups a multi: true critical entry and its stack frames into one block', async () => {
    const wl = parseWatchlist(
      JSON.stringify({
        critical: [{ keyword: 'ERROR', multi: true }],
        notice: ['INFO'],
      }),
    );
    expect(wl.ok).toBe(true);
    if (!wl.ok) return;
    const input = [
      'INFO init',
      'ERROR NullPointerException',
      '    at com.foo.Bar(Bar.java:1)',
      '    at com.foo.Qux(Qux.java:2)',
      'INFO done',
    ].join('\n');
    const r = await run({ input, watchlist: wl.value });
    expect(r.exitCode).toBe(1);
    expect(r.counts.critical).toBe(1);
    expect(r.counts.lines).toBe(5);
    expect(r.counts.notice).toBe(2);
    expect(r.counts.anomalies).toBe(0);
    expect(r.output).toContain('\x1b[31mERROR\x1b[0m \x1b[31mNullPointerException\x1b[0m');
    expect(r.output).toContain('\x1b[31m    at com.foo.Bar(Bar.java:1)\x1b[0m');
    expect(r.output).toContain('\x1b[31m    at com.foo.Qux(Qux.java:2)\x1b[0m');
    expect(r.output).toContain('\x1b[36mINFO\x1b[0m init');
    expect(r.output).toContain('\x1b[36mINFO\x1b[0m done');
    expect(r.output).not.toContain('\x1b[36mNullPointerException');
  });
});

describe('run() with new tier names', () => {
  it('treats "notice" tier as info dest (cyan, rank=2)', async () => {
    const w = { critical: ['FATAL'], notice: ['INFO'] };
    const input = ['INFO ready', 'FATAL boom'].join('\n');
    const result = await run({ input, watchlist: w });
    expect(result.exitCode).toBe(1);
    expect(result.counts.critical).toBe(1);
    expect(result.counts.notice).toBe(1);
    expect(result.counts.info).toBe(0);
    expect(result.output).toContain('\x1b[36mINFO\x1b[0m');
  });

  it('counts each tier independently in counts.* map', async () => {
    const wl = {
      critical: ['FATAL'],
      warning: ['WARN'],
      notice: ['INFO'],
      debug: ['TRACE'],
    };
    const input = ['TRACE one', 'INFO two', 'WARN three', 'FATAL four', 'INFO five'].join('\n');
    const r = await run({ input, watchlist: wl });
    expect(r.exitCode).toBe(1);
    expect(r.counts.critical).toBe(1);
    expect(r.counts.warning).toBe(1);
    expect(r.counts.notice).toBe(2);
    expect(r.counts.debug).toBe(1);
    expect(r.counts.lines).toBe(5);
  });
});

describe('run() min-severity filter', () => {
  it('filters out hits above the cutoff and counts only kept severity', async () => {
    const wl = { critical: ['FATAL'], notice: ['INFO'], debug: ['TRACE'] };
    const input = ['TRACE one', 'INFO two', 'unmatched', 'FATAL three'].join('\n');
    const r = await run({ input, watchlist: wl, minSeverity: 'warning' });
    expect(r.exitCode).toBe(1);
    expect(r.counts.critical).toBe(1);
    expect(r.counts.notice).toBe(0);
    expect(r.counts.debug).toBe(0);
    expect(r.counts.anomalies).toBe(1);
    expect(r.anomalies[0]).toMatchObject({
      type: 'anomaly',
      file: null,
      line: 3,
      text: 'unmatched',
      status: 'insufficient_baseline',
    });
    expect(r.records).toEqual([
      {
        file: null,
        line: 4,
        severity: 'critical',
        match: 'FATAL',
        source: 'user_watchlist',
      },
    ]);
  });

  it('drops note tier entirely with minSeverity=critical and exits 0 with no critical', async () => {
    const wl = { critical: ['FATAL'], notice: ['INFO'] };
    const input = ['INFO ready'].join('\n');
    const r = await run({ input, watchlist: wl, minSeverity: 'critical' });
    expect(r.exitCode).toBe(0);
    expect(r.counts.critical).toBe(0);
    expect(r.counts.notice).toBe(0);
    expect(r.records).toHaveLength(0);
    expect(r.output).toBe('INFO ready');
  });

  it('throws on unknown tier name in minSeverity', async () => {
    const wl = { critical: ['FATAL'] };
    await expect(run({ input: 'FATAL boom', watchlist: wl, minSeverity: 'fatal' })).rejects.toThrow(
      /unknown tier/,
    );
  });
});
