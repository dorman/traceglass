// @vitest-environment node
import { describe, expect, it } from 'vitest';

const { decorate } = await import('../../cli/logsift.mjs');

const NOTICE_HITS = [{ keyword: 'INFO', severity: 'notice', start: 4, length: 4 }];
const CRITICAL_HITS = [{ keyword: 'FATAL', severity: 'critical', start: 0, length: 5 }];

describe('decorate()', () => {
  it('leaves a line with no hits unchanged', () => {
    expect(decorate('plain line', [])).toBe('plain line');
  });

  it('wraps a notice hit in cyan', () => {
    const line = 'foo INFO bar';
    const got = decorate(line, NOTICE_HITS);
    expect(got).toContain('\x1b[36mINFO\x1b[0m');
    expect(got).toBe('foo \x1b[36mINFO\x1b[0m bar');
  });

  it('wraps a critical hit in red', () => {
    const got = decorate('FATAL boom', CRITICAL_HITS);
    expect(got).toBe('\x1b[31mFATAL\x1b[0m boom');
  });

  it('picks critical as the line color when both severities match', () => {
    const line = 'FATAL info note';
    const hits = [
      { keyword: 'FATAL', severity: 'critical', start: 0, length: 5 },
      { keyword: 'info', severity: 'notice', start: 6, length: 4 },
    ];
    const got = decorate(line, hits);
    expect(got).toBe('\x1b[31mFATAL\x1b[0m \x1b[31minfo\x1b[0m note');
    expect(got).not.toContain('\x1b[36m');
  });

  it('preserves the original substring verbatim', () => {
    const hits = [{ keyword: 'rdy', severity: 'notice', start: 0, length: 3 }];
    expect(decorate('ready', hits)).toBe('\x1b[36mrea\x1b[0mdy');
    expect(decorate('READY', hits)).toBe('\x1b[36mREA\x1b[0mDY');
  });

  it('does not re-color an already-overlapping hit', () => {
    const line = 'FATAL FATAL';
    const hits = [
      { keyword: 'FATAL', severity: 'critical', start: 0, length: 5 },
      { keyword: 'FATAL', severity: 'critical', start: 6, length: 5 },
    ];
    const got = decorate(line, hits);
    expect(got).toBe('\x1b[31mFATAL\x1b[0m \x1b[31mFATAL\x1b[0m');
  });

  it('decorates a Java-style stack trace as a single red block', () => {
    const hits = [{ keyword: 'ERROR', severity: 'critical', start: 0, length: 5 }];
    const continuations = [
      '    at com.foo.Bar.baz(Bar.java:42)',
      '    at com.foo.Qux.run(Qux.java:7)',
    ];
    const got = decorate('ERROR NullPointerException', hits, continuations);
    expect(got).toContain('\x1b[31mERROR\x1b[0m');
    expect(got).toContain('\x1b[31mNullPointerException\x1b[0m');
    expect(got).toContain('\x1b[31m    at com.foo.Bar.baz(Bar.java:42)\x1b[0m');
    expect(got).toContain('\x1b[31m    at com.foo.Qux.run(Qux.java:7)\x1b[0m');
    expect(got).not.toContain('\x1b[36m');
    const newlineCount = (got.match(/\n/g) ?? []).length;
    expect(newlineCount).toBe(2);
  });

  it('joins a JSON array spread continuation', () => {
    const hits = [{ keyword: 'INFO', severity: 'notice', start: 0, length: 4 }];
    const continuations = ['  { "id": 1 },', '  { "id": 2 }'];
    const got = decorate('INFO events:', hits, continuations);
    expect(got).toContain('\x1b[36mINFO\x1b[0m');
    expect(got).toContain('\x1b[36mevents:\x1b[0m');
    expect(got).toContain('\x1b[36m  { "id": 1 },\x1b[0m');
    expect(got).toContain('\x1b[36m  { "id": 2 }\x1b[0m');
    expect(got).not.toContain('\x1b[31m');
  });

  it('joins a plain whitespace-only continuation as a red critical block', () => {
    const hits = [{ keyword: 'FATAL', severity: 'critical', start: 0, length: 5 }];
    const continuations = ['  caused by: alloc'];
    const got = decorate('FATAL: oom', hits, continuations);
    expect(got).toContain('\x1b[31mFATAL\x1b[0m');
    expect(got).toContain('\x1b[31moom\x1b[0m');
    expect(got).toContain('\x1b[31m  caused by: alloc\x1b[0m');
    expect(got).not.toContain('\x1b[36m');
  });

  it('honors the legacy "info" tier as cyan (alias of "notice")', () => {
    const hits = [{ keyword: 'INFO', severity: 'info', start: 0, length: 4 }];
    expect(decorate('INFO ready', hits)).toContain('\x1b[36mINFO\x1b[0m');
  });

  it('colors a warning-tier keyword yellow', () => {
    const hits = [{ keyword: 'WARN', severity: 'warning', start: 0, length: 4 }];
    expect(decorate('WARN disk full', hits)).toBe('\x1b[33mWARN\x1b[0m disk full');
  });

  it('colors a debug-tier keyword gray', () => {
    const hits = [{ keyword: 'TRACE', severity: 'debug', start: 0, length: 5 }];
    expect(decorate('TRACE done', hits)).toContain('\x1b[90mTRACE\x1b[0m');
  });

  it('filters out hits above the cutoff when minRank is supplied via options (and renders the line un-decorated)', () => {
    const hits = [{ keyword: 'INFO', severity: 'notice', start: 0, length: 4 }];
    const got = decorate('INFO ready', hits, [], { minRank: 1 });
    expect(got).toBe('INFO ready');
    expect(got).not.toContain('\x1b[');
  });
});
