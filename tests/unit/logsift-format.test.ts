// @vitest-environment node

import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { MatchRecord, OutputRecord } from '../../cli/logsift.d.mts';

const { run, parseWatchlist, parseArgs, serialize, main } = await import('../../cli/logsift.mjs');

const WATCHLIST_PATH = fileURLToPath(new URL('../../cli/watchlist.example.json', import.meta.url));
const SIGNATURES_PATH = fileURLToPath(new URL('../../signatures/v0.1.0/', import.meta.url));
const V020_SIGNATURES_PATH = fileURLToPath(new URL('../../signatures/v0.2.0/', import.meta.url));

function loadWatchlist() {
  const raw = readFileSync(WATCHLIST_PATH, 'utf-8');
  const parsed = parseWatchlist(raw);
  if (!parsed.ok) throw new Error(`invalid watchlist: ${parsed.error}`);
  return parsed.value;
}

describe('run() records', () => {
  it('produces records with an explicit user-watchlist source on every row', async () => {
    const watchlist = loadWatchlist();
    const input = ['INFO starting', 'FATAL oom', 'INFO done'].join('\n');
    const result = await run({ input, watchlist, file: 'app.log' });
    expect(result.records.length).toBeGreaterThan(0);
    for (const r of result.records) {
      expect(Object.keys(r).sort()).toEqual(['file', 'line', 'match', 'severity', 'source']);
      expect(r.source).toBe('user_watchlist');
      expect(r.file).toBe('app.log');
      expect(typeof r.line).toBe('number');
      expect(['critical', 'notice']).toContain(r.severity);
      expect(typeof r.match).toBe('string');
      expect(r.match.length).toBeGreaterThan(0);
    }
  });

  it('emits one record per occurrence on multi-match input', async () => {
    const watchlist = loadWatchlist();
    const input = 'INFO alpha INFO beta INFO gamma';
    const result = await run({ input, watchlist });
    const noticeRecords = result.records.filter((r) => r.severity === 'notice');
    expect(noticeRecords).toHaveLength(3);
    for (const r of noticeRecords) expect(r.match.toLowerCase()).toBe('info');
  });

  it('carries the file argument through to the records', async () => {
    const watchlist = loadWatchlist();
    const result = await run({ input: 'INFO ready\n', watchlist, file: '/var/log/sys.log' });
    expect(result.records[0]?.file).toBe('/var/log/sys.log');
  });

  it('reports null file when no file argument is supplied (stdin mode)', async () => {
    const watchlist = loadWatchlist();
    const result = await run({ input: 'INFO ready\n', watchlist });
    expect(result.records[0]?.file).toBeNull();
  });

  it('threads the 1-based line number correctly', async () => {
    const watchlist = loadWatchlist();
    const input = ['FATAL first', 'INFO second', 'INFO third'].join('\n');
    const result = await run({ input, watchlist, file: 'l.log' });
    expect(result.records.map((r) => r.line)).toEqual([1, 2, 3]);
  });
});

describe('format selector (parseArgs)', () => {
  it('defaults to text when no flag is provided', () => {
    const args = parseArgs([], {});
    expect(args.format).toBe('text');
    expect(args.formatError).toBeNull();
  });

  it('parses --format csv', () => {
    const args = parseArgs(['--format', 'csv'], {});
    expect(args.format).toBe('csv');
    expect(args.formatError).toBeNull();
  });

  it('parses --format=json', () => {
    const args = parseArgs(['--format=json'], {});
    expect(args.format).toBe('json');
    expect(args.formatError).toBeNull();
  });

  it('rejects unknown --format values (format: null, formatError: "xml")', () => {
    const args = parseArgs(['--format', 'xml'], {});
    expect(args.format).toBeNull();
    expect(args.formatError).toBe('xml');
  });

  it('rejects unknown LOGSIFT_FORMAT env values too', () => {
    const args = parseArgs([], { LOGSIFT_FORMAT: 'xml' });
    expect(args.format).toBeNull();
    expect(args.formatError).toBe('xml');
  });

  it('reads LOGSIFT_FORMAT env when no flag is given', () => {
    const args = parseArgs([], { LOGSIFT_FORMAT: 'csv' });
    expect(args.format).toBe('csv');
    expect(args.formatError).toBeNull();
  });
});

describe('lens selector (parseArgs)', () => {
  it('defaults to General Triage and accepts flag/env selection', () => {
    expect(parseArgs([], {}).lens).toBe('general-triage');
    expect(parseArgs(['--lens', 'security-signals'], {}).lens).toBe('security-signals');
    expect(parseArgs(['--lens=incident-reliability'], {}).lens).toBe('incident-reliability');
    expect(parseArgs([], { LOGSIFT_LENS: 'security-signals' }).lens).toBe('security-signals');
  });
});

describe('min-severity selector (parseArgs)', () => {
  it('defaults to null (no cutoff) when no flag is provided', () => {
    const args = parseArgs([], {});
    expect(args.minSeverity).toBeNull();
    expect(args.minSeverityError).toBeNull();
  });

  it('parses --min-severity warning', () => {
    const args = parseArgs(['--min-severity', 'warning'], {});
    expect(args.minSeverity).toBe('warning');
    expect(args.minSeverityError).toBeNull();
  });

  it('parses --min-severity=critical', () => {
    const args = parseArgs(['--min-severity=critical'], {});
    expect(args.minSeverity).toBe('critical');
    expect(args.minSeverityError).toBeNull();
  });

  it('rejects unknown --min-severity values (minSeverity: null, minSeverityError: "fatal")', () => {
    const args = parseArgs(['--min-severity', 'fatal'], {});
    expect(args.minSeverity).toBeNull();
    expect(args.minSeverityError).toBe('fatal');
  });
});

describe('serialize() json', () => {
  it('emits a parseable JSON array terminated with a newline', () => {
    const records: OutputRecord[] = [
      { file: 'a.log', line: 1, severity: 'critical', match: 'FATAL' },
      { file: 'a.log', line: 2, severity: 'info', match: 'INFO' },
    ];
    const out = serialize(records, 'json');
    expect(out.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual([
      { file: 'a.log', line: 1, severity: 'critical', match: 'FATAL' },
      { file: 'a.log', line: 2, severity: 'info', match: 'INFO' },
    ]);
  });

  it('preserves exact shape even when match contains special characters', () => {
    const records: MatchRecord[] = [
      { file: null, line: 1, severity: 'info', match: 'he said "hi"' },
    ];
    const out = serialize(records, 'json');
    const parsed = JSON.parse(out);
    expect(parsed[0]?.match).toBe('he said "hi"');
    expect(parsed[0]?.file).toBeNull();
  });

  it('adds an explicit anomaly discriminator without changing matched records', () => {
    const records: OutputRecord[] = [
      { file: 'a.log', line: 1, severity: 'info', match: 'INFO' },
      {
        type: 'anomaly',
        file: 'a.log',
        line: 2,
        text: 'raw unmatched line',
        score: 0.75,
        confidence: 0.5,
        status: 'scored',
        inputs: {
          template: 'raw unmatched line',
          baselineSize: 5,
          templateSupport: 1,
          distinctTemplates: 4,
          minimumBaseline: 5,
          leaveOneOut: true,
        },
        explanation: 'rarity explains this row',
        limitations: ['local-only evidence'],
      },
    ];
    const parsed = JSON.parse(serialize(records, 'json'));
    expect(parsed[0]).toEqual({ file: 'a.log', line: 1, severity: 'info', match: 'INFO' });
    expect(parsed[1]).toMatchObject({
      type: 'anomaly',
      file: 'a.log',
      line: 2,
      text: 'raw unmatched line',
      score: 0.75,
      status: 'scored',
    });
  });
});

describe('serialize() csv', () => {
  it('emits the header row with the explicit record type and text columns', () => {
    const out = serialize([], 'csv');
    expect(out).toBe(
      'file,line,severity,match,type,text,source,signature_id,catalog,version,set,pattern,explanation,severity_rationale,false_positive_note,lens_id,lens_version,lens_group,lens_priority,anomaly_score,anomaly_confidence,anomaly_status,anomaly_inputs,anomaly_explanation,anomaly_limitations',
    );
  });

  it('produces one row per record with numeric line unquoted', () => {
    const records: OutputRecord[] = [
      { file: 'a.log', line: 1, severity: 'critical', match: 'FATAL' },
      { file: null, line: 2, severity: 'info', match: 'ready' },
    ];
    const out = serialize(records, 'csv');
    const lines = out.split('\n');
    expect(lines[0]).toContain('source,signature_id,catalog,version,set,pattern');
    expect(lines[1]).toContain('a.log,1,critical,FATAL,match,,user_watchlist');
    expect(lines[2]).toContain(',2,info,ready,match,,user_watchlist');
  });

  it('escapes fields that contain commas, quotes, or newlines per RFC-4180', () => {
    const records: MatchRecord[] = [
      { file: 'a,b.log', line: 1, severity: 'critical', match: 'oh "no"' },
      { file: 'c.log', line: 2, severity: 'info', match: 'line1\nline2' },
    ];
    const out = serialize(records, 'csv');
    expect(out).toContain('"a,b.log",1,critical,"oh ""no""",match,,user_watchlist');
    expect(out).toContain('c.log,2,info,"line1\nline2",match,,user_watchlist');
  });

  it('escapes CR (\\r) per RFC-4180', () => {
    const records: MatchRecord[] = [{ file: 'x', line: 9, severity: 'info', match: 'a\rb' }];
    const out = serialize(records, 'csv');
    expect(out.split('\n')[1]).toContain('x,9,info,"a\rb",match,,user_watchlist');
  });

  it('quotes only the match field, leaves line numeric and unquoted', () => {
    const records: MatchRecord[] = [{ file: null, line: 7, severity: 'info', match: 'plain' }];
    const out = serialize(records, 'csv');
    expect(out).toContain(',7,info,plain,match,,user_watchlist');
  });

  it('serializes anomaly rows with their raw text and explicit type', () => {
    const out = serialize(
      [
        {
          type: 'anomaly',
          file: null,
          line: 3,
          text: 'unmatched, "raw"',
          score: 1,
          confidence: 0.75,
          status: 'scored',
          inputs: {
            template: 'unmatched, "raw"',
            baselineSize: 6,
            templateSupport: 0,
            distinctTemplates: 6,
            minimumBaseline: 5,
            leaveOneOut: true,
          },
          explanation: 'rare template',
          limitations: ['local baseline'],
        },
      ],
      'csv',
    );
    expect(out).toContain(',3,,,anomaly,"unmatched, ""raw"""');
    expect(out).toContain(',1,0.75,scored,');
    expect(out).toContain('rare template');
  });
});

describe('main() format dispatch', () => {
  function makeStdin(text: string) {
    return Readable.from([text]);
  }

  it('emits json to stdout for --format json', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const proc = { exitCode: 0 };
    const result = await main(['--format', 'json', '--watchlist', WATCHLIST_PATH], {
      stdout: { write: (s) => out.push(s) },
      stderr: { write: (s) => err.push(s) },
      stdin: makeStdin('INFO ready\nFATAL boom\n'),
      env: {} as NodeJS.ProcessEnv,
      process: proc,
    });
    const blob = out.join('');
    expect(blob.length).toBeGreaterThan(0);
    const parsed = JSON.parse(blob);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    for (const r of parsed) {
      expect(Object.keys(r).sort()).toEqual(['file', 'line', 'match', 'severity', 'source']);
      expect(r.source).toBe('user_watchlist');
    }
    expect(result.format).toBe('json');
    expect(proc.exitCode).toBe(1);
  });

  it('emits csv to stdout for --format csv with the header row first', async () => {
    const out: string[] = [];
    const proc = { exitCode: 0 };
    await main(['--format', 'csv', '--watchlist', WATCHLIST_PATH], {
      stdout: { write: (s) => out.push(s) },
      stderr: { write: () => {} },
      stdin: makeStdin('INFO ready\nFATAL boom\n'),
      env: {} as NodeJS.ProcessEnv,
      process: proc,
    });
    const blob = out.join('');
    expect(blob.split('\n')[0]).toContain(
      'file,line,severity,match,type,text,source,signature_id',
    );
  });

  it('exits 2 with stderr message on unknown --format', async () => {
    const err: string[] = [];
    const proc = { exitCode: 0 };
    const result = await main(['--format', 'xml', '--watchlist', WATCHLIST_PATH], {
      stdout: { write: () => {} },
      stderr: { write: (s) => err.push(s) },
      stdin: makeStdin(''),
      env: {} as NodeJS.ProcessEnv,
      process: proc,
    });
    expect(proc.exitCode).toBe(2);
    expect(result.exitCode).toBe(2);
    expect(result.ok).toBe(false);
    expect(err.join('')).toMatch(/unknown/);
    expect(err.join('')).toMatch(/xml/);
  });

  it('text mode default still writes the decorated output', async () => {
    const out: string[] = [];
    const proc = { exitCode: 0 };
    await main(['--watchlist', WATCHLIST_PATH], {
      stdout: { write: (s) => out.push(s) },
      stderr: { write: () => {} },
      stdin: makeStdin('FATAL boom\n'),
      env: {} as NodeJS.ProcessEnv,
      process: proc,
    });
    const blob = out.join('');
    expect(blob).toContain('\x1b[31mFATAL\x1b[0m');
    expect(proc.exitCode).toBe(1);
  });

  it('reports a bounded anomaly sample in the text-mode stderr report', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const proc = { exitCode: 0 };
    await main(['--watchlist', WATCHLIST_PATH], {
      stdout: { write: (s) => out.push(s) },
      stderr: { write: (s) => err.push(s) },
      stdin: makeStdin('unknown one\nunknown two\nINFO ready\nunknown three\nunknown four\n'),
      env: {} as NodeJS.ProcessEnv,
      process: proc,
    });
    const report = err.join('');
    expect(report).toContain('anomalies=4');
    expect(report).toContain('line 1: unknown one');
    expect(report).toContain('line 2: unknown two');
    expect(report).toContain('line 4: unknown three');
    expect(report).toContain('1 additional anomalous lines omitted');
  });

  it('includes anomaly records in JSON output while preserving matches', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const proc = { exitCode: 0 };
    const result = await main(['--format', 'json', '--watchlist', WATCHLIST_PATH], {
      stdout: { write: (s) => out.push(s) },
      stderr: { write: (s) => err.push(s) },
      stdin: makeStdin('unknown\nINFO ready\n'),
      env: {} as NodeJS.ProcessEnv,
      process: proc,
    });

    expect(result.counts?.anomalies).toBe(1);
    const records = JSON.parse(out.join(''));
    expect(records[0]).toMatchObject({
      type: 'anomaly',
      file: null,
      line: 1,
      text: 'unknown',
      score: 0,
      confidence: 0,
      status: 'insufficient_baseline',
    });
    expect(records.slice(1)).toEqual([
      {
        file: null,
        line: 2,
        severity: 'notice',
        match: 'INFO',
        source: 'user_watchlist',
      },
      {
        file: null,
        line: 2,
        severity: 'notice',
        match: 'ready',
        source: 'user_watchlist',
      },
    ]);
    expect(err.join('')).not.toContain('line 1: unknown');
  });
});

describe('main() min-severity filter', () => {
  function makeStdin(text: string) {
    return Readable.from([text]);
  }

  it('--min-severity warning drops notice-tier records but keeps critical', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const proc = { exitCode: 0 };
    await main(['--min-severity', 'warning', '--watchlist', WATCHLIST_PATH], {
      stdout: { write: (s) => out.push(s) },
      stderr: { write: (s) => err.push(s) },
      stdin: makeStdin('INFO ready\nFATAL boom\n'),
      env: {} as NodeJS.ProcessEnv,
      process: proc,
    });
    const errJoined = err.join('');
    expect(errJoined).toMatch(/critical=1/);
    expect(errJoined).toMatch(/notice=0/);
    expect(proc.exitCode).toBe(1);
    // INFO line is rendered without ANSI decoration because notice is filtered out.
    expect(out.join('')).not.toContain('\x1b[36mINFO\x1b[0m');
  });

  it('--min-severity critical drops everything except critical; exit 0 when no critical', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const proc = { exitCode: 0 };
    await main(['--min-severity', 'critical', '--watchlist', WATCHLIST_PATH], {
      stdout: { write: (s) => out.push(s) },
      stderr: { write: (s) => err.push(s) },
      stdin: makeStdin('INFO ready\n'),
      env: {} as NodeJS.ProcessEnv,
      process: proc,
    });
    expect(proc.exitCode).toBe(0);
    const errJoined = err.join('');
    expect(errJoined).toMatch(/notice=0/);
    expect(errJoined).toMatch(/critical=0/);
    expect(out.join('')).not.toContain('\x1b[36m');
  });

  it('exits 2 with stderr message on unknown --min-severity', async () => {
    const err: string[] = [];
    const proc = { exitCode: 0 };
    const result = await main(['--min-severity', 'fatal', '--watchlist', WATCHLIST_PATH], {
      stdout: { write: () => {} },
      stderr: { write: (s) => err.push(s) },
      stdin: makeStdin(''),
      env: {} as NodeJS.ProcessEnv,
      process: proc,
    });
    expect(proc.exitCode).toBe(2);
    expect(result.exitCode).toBe(2);
    expect(result.ok).toBe(false);
    expect(err.join('')).toMatch(/min-severity/);
    expect(err.join('')).toMatch(/fatal/);
  });
});

describe('main() signature library selection', () => {
  function makeStdin(text: string) {
    return Readable.from([text]);
  }

  function baseOptions(out: string[], err: string[], env: Partial<NodeJS.ProcessEnv>) {
    return {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
      stdin: makeStdin(''),
      env,
      process: { exitCode: 0 },
    };
  }

  it('parses both separated and equals-form --signatures values', () => {
    expect(parseArgs(['--signatures', SIGNATURES_PATH], {}).signatures).toBe(SIGNATURES_PATH);
    expect(parseArgs([`--signatures=${SIGNATURES_PATH}`], {}).signatures).toBe(SIGNATURES_PATH);
    expect(parseArgs([], {}).signatures).toBeNull();
  });

  it('merges the explicit v0.2.0 catalog after the base watchlist and includes all new vendor sets', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const options = baseOptions(out, err, {
      LOGSIFT_SIGNATURES: '/path/that/must/not/be-used',
    });
    options.stdin = makeStdin(
      'ERROR search peer idx-01 failed to respond\n' +
        'FATAL: too many connections for role "app"\n' +
        'GET /health 503\n' +
        'container exited with non-zero code (137)\n' +
        'Security EventID=4625: failed logon\n' +
        'CrowdStrike detection prevented execution\n',
    );

    const result = await main(
      ['--format', 'json', '--watchlist', WATCHLIST_PATH, '--signatures', V020_SIGNATURES_PATH],
      options,
    );

    const records = JSON.parse(out.join('')) as Array<{
      line: number;
      severity: string;
      match: string;
      source?: string;
      signature?: Record<string, unknown>;
    }>;
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.counts).toMatchObject({ critical: 5, warning: 1 });
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ line: 1, severity: 'critical', match: 'ERROR' }),
        expect.objectContaining({
          line: 1,
          severity: 'critical',
          match: 'search peer idx-01 failed',
        }),
        expect.objectContaining({ line: 2, severity: 'critical', match: 'FATAL' }),
        expect.objectContaining({ line: 3, severity: 'warning', match: '503' }),
        expect.objectContaining({
          line: 4,
          severity: 'critical',
          match: 'container exited with non-zero code',
        }),
        expect.objectContaining({ line: 5, severity: 'critical', match: 'EventID=4625' }),
        expect.objectContaining({
          line: 6,
          severity: 'critical',
          match: 'CrowdStrike detection prevented',
        }),
      ]),
    );
    expect(
      records.findIndex((record) => record.line === 1 && record.match === 'ERROR'),
    ).toBeLessThan(
      records.findIndex(
        (record) => record.line === 1 && record.match === 'search peer idx-01 failed',
      ),
    );
    expect(records.some((record) => record.match === 'search peer idx-01 failed')).toBe(true);
    expect(records.some((record) => record.match === 'EventID=4625')).toBe(true);
    expect(records.some((record) => record.match === 'CrowdStrike detection prevented')).toBe(true);
    const userHit = records.find((record) => record.match === 'ERROR');
    const builtinHit = records.find((record) => record.match === 'search peer idx-01 failed');
    expect(userHit).toMatchObject({ source: 'user_watchlist' });
    expect(userHit).not.toHaveProperty('signature');
    expect(builtinHit).toMatchObject({
      source: 'builtin',
      signature: expect.objectContaining({
        id: 'splunk-search-peer-failure',
        catalog: 'logsift-json-manifests',
        severityRationale: expect.any(String),
        falsePositiveNote: expect.any(String),
      }),
    });
    expect(JSON.stringify(records)).not.toMatch(/verdict|classification|aiGenerated/i);
    expect(err.join('')).toContain('counts: lines=6');
  });

  it('uses LOGSIFT_SIGNATURES when the explicit flag is absent', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const options = baseOptions(out, err, { LOGSIFT_SIGNATURES: SIGNATURES_PATH });
    options.stdin = makeStdin('statement_timeout\n');

    const result = await main(['--format', 'json', '--watchlist', WATCHLIST_PATH], options);

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.records).toEqual([
      {
        file: null,
        line: 1,
        severity: 'warning',
        match: 'statement_timeout',
        source: 'builtin',
        signature: expect.objectContaining({ id: 'postgres-statement-timeout', source: 'builtin' }),
      },
    ]);
  });

  it('reports the selected lens on trusted catalog matches and rejects unknown lenses', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const options = baseOptions(out, err, {});
    options.stdin = makeStdin('connection timeout while contacting postgres\n');
    const result = await main(
      ['--format', 'json', '--lens', 'incident-reliability', '--watchlist', WATCHLIST_PATH, '--signatures', SIGNATURES_PATH],
      options,
    );
    const records = JSON.parse(out.join('')) as Array<{ signature?: { lens?: Record<string, unknown> } }>;
    const catalogRecord = records.find((record) => record.signature?.lens);
    expect(result.ok).toBe(true);
    expect(catalogRecord?.signature?.lens).toMatchObject({
      id: 'incident-reliability',
      version: 'v0.1.0',
      group: 'availability-dependency',
      priority: 10,
    });

    const invalidOut: string[] = [];
    const invalidErr: string[] = [];
    const invalid = await main(
      ['--format', 'json', '--lens', 'unknown-lens', '--watchlist', WATCHLIST_PATH],
      baseOptions(invalidOut, invalidErr, {}),
    );
    expect(invalid).toMatchObject({ ok: false, exitCode: 2 });
    expect(invalidErr.join('')).toContain('unknown --lens');
  });

  it('returns exit code 2 when the selected signatures directory cannot be read', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const options = baseOptions(out, err, {});
    options.stdin = makeStdin('');

    const result = await main(
      ['--watchlist', WATCHLIST_PATH, '--signatures', '/path/that/does/not/exist'],
      options,
    );

    expect(result).toMatchObject({ ok: false, exitCode: 2 });
    expect(err.join('')).toMatch(/cannot read signatures directory/);
  });
});
