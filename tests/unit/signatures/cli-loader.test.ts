// @vitest-environment node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const { loadSignatureDirectory, loadSignatureManifest, run, validateSignatureManifest } =
  await import('../../../cli/logsift.mjs');

const SEED_PATH = fileURLToPath(new URL('../../../signatures/v0.1.0/', import.meta.url));
const V020_PATH = fileURLToPath(new URL('../../../signatures/v0.2.0/', import.meta.url));
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function makeTemporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), 'logsift-signatures-'));
  temporaryRoots.push(root);
  return root;
}

function writeManifest(root: string, relativePath: string, value: unknown) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value));
  return path;
}

const validManifest = {
  version: 'v0.1.0',
  set: 'custom-set',
  title: 'Custom set',
  description: 'A valid custom signature set.',
  patterns: [{ name: 'fatal', severity: 'critical', match: { string: 'FATAL' } }],
};

describe('CLI signature manifest validation', () => {
  it('accepts the published manifest shape and compiles its regex sources', () => {
    const parsed = JSON.parse(readFileSync(join(SEED_PATH, 'nginx-access-errors.json'), 'utf8'));
    const result = validateSignatureManifest(parsed);
    expect(result.ok).toBe(true);

    const loaded = loadSignatureManifest(parsed);
    expect(loaded.entries).toHaveLength(4);
    expect(loaded.entries.find((entry) => entry.signature?.name === '5xx response')).toMatchObject({
      regex: '\\b5[0-9]{2}\\b',
      flags: 'i',
      tier: 'warning',
      signature: { set: 'nginx-access-errors', name: '5xx response' },
    });
  });

  it('rejects missing fields, invalid ids, empty descriptions, bad match shapes, and flags', () => {
    const invalidManifests = [
      { ...validManifest, version: '0.1.0' },
      { ...validManifest, set: 'Bad_Set' },
      { ...validManifest, description: '   ' },
      { ...validManifest, patterns: [] },
      {
        ...validManifest,
        patterns: [{ name: 'both', severity: 'critical', match: { string: 'a', regex: 'b' } }],
      },
      {
        ...validManifest,
        patterns: [{ name: 'bad flags', severity: 'critical', match: { string: 'a', flags: 'g' } }],
      },
    ];

    for (const manifest of invalidManifests) {
      expect(validateSignatureManifest(manifest).ok).toBe(false);
    }
  });

  it('rejects a syntactically invalid regex during load, not during matching', () => {
    expect(() =>
      loadSignatureManifest({
        ...validManifest,
        patterns: [{ name: 'bad regex', severity: 'critical', match: { regex: '[' } }],
      }),
    ).toThrow(/invalid regex/);
  });
});

describe('loadSignatureDirectory()', () => {
  it('recursively merges the three seeded sets with the documented tier totals', () => {
    const warnings: string[] = [];
    const started = performance.now();
    const loaded = loadSignatureDirectory(SEED_PATH, {
      onWarning: (warning) => warnings.push(warning),
    });
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(100);
    expect(warnings).toEqual([]);
    expect(loaded.manifests.map((manifest) => manifest.set)).toEqual([
      'docker-container-crashes',
      'nginx-access-errors',
      'postgres-timeouts',
    ]);
    expect(loaded.entries).toHaveLength(14);
    expect(loaded.counts).toEqual({ critical: 9, warning: 3, notice: 2, debug: 0 });
    expect(loaded.watchlist.critical).toHaveLength(9);
    expect(loaded.watchlist.warning).toHaveLength(3);
    expect(loaded.watchlist.notice).toHaveLength(2);
    expect(loaded.watchlist.debug).toHaveLength(0);
    expect(loaded.countsBySet).toEqual({
      'docker-container-crashes': { critical: 4, warning: 0, notice: 1, debug: 0 },
      'nginx-access-errors': { critical: 2, warning: 1, notice: 1, debug: 0 },
      'postgres-timeouts': { critical: 3, warning: 2, notice: 0, debug: 0 },
    });
    expect(loaded.entries.some((entry) => entry.signature?.set === 'schema-example')).toBe(false);
  });

  it('loads the v0.2.0 baseline and all three new vendor sets without warnings', () => {
    const warnings: string[] = [];
    const loaded = loadSignatureDirectory(V020_PATH, {
      onWarning: (warning) => warnings.push(warning),
    });

    expect(warnings).toEqual([]);
    expect(loaded.manifests.map((manifest) => manifest.set)).toEqual([
      'antivirus-edr-alerts',
      'docker-container-crashes',
      'nginx-access-errors',
      'postgres-timeouts',
      'splunk-search-errors',
      'windows-event-anomalies',
    ]);
    expect(loaded.manifests.map((manifest) => [manifest.set, manifest.version])).toEqual([
      ['antivirus-edr-alerts', 'v0.2.0'],
      ['docker-container-crashes', 'v0.1.0'],
      ['nginx-access-errors', 'v0.1.0'],
      ['postgres-timeouts', 'v0.1.0'],
      ['splunk-search-errors', 'v0.2.0'],
      ['windows-event-anomalies', 'v0.2.0'],
    ]);
    expect(loaded.entries).toHaveLength(27);
    expect(loaded.countsBySet).toMatchObject({
      'docker-container-crashes': { critical: 4, warning: 0, notice: 1, debug: 0 },
      'nginx-access-errors': { critical: 2, warning: 1, notice: 1, debug: 0 },
      'postgres-timeouts': { critical: 3, warning: 2, notice: 0, debug: 0 },
      'splunk-search-errors': { critical: 2, warning: 1, notice: 1, debug: 0 },
      'windows-event-anomalies': { critical: 2, warning: 1, notice: 1, debug: 0 },
      'antivirus-edr-alerts': { critical: 2, warning: 2, notice: 1, debug: 0 },
    });
    expect(loaded.entries.some((entry) => entry.signature?.set === 'splunk-search-errors')).toBe(
      true,
    );
    expect(loaded.entries.some((entry) => entry.signature?.set === 'windows-event-anomalies')).toBe(
      true,
    );
    expect(loaded.entries.some((entry) => entry.signature?.set === 'antivirus-edr-alerts')).toBe(
      true,
    );
  });

  it('walks nested directories in sorted order and skips malformed siblings with warnings', () => {
    const root = makeTemporaryRoot();
    const warnings: string[] = [];
    const validPath = writeManifest(root, 'nested/z-valid.json', validManifest);
    const badJsonPath = writeManifest(root, 'a-bad.json', '{not json');
    const badShapePath = writeManifest(root, 'nested/a-shape.json', {
      ...validManifest,
      set: 'not_valid',
    });
    const badRegexPath = writeManifest(root, 'nested/deeper/b-regex.json', {
      ...validManifest,
      patterns: [{ name: 'bad regex', severity: 'critical', match: { regex: '(' } }],
    });

    const loaded = loadSignatureDirectory(root, { warn: (warning) => warnings.push(warning) });

    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0]?.signature?.name).toBe('fatal');
    expect(warnings).toHaveLength(3);
    expect(warnings.join('\n')).toContain(badJsonPath);
    expect(warnings.join('\n')).toContain(badShapePath);
    expect(warnings.join('\n')).toContain(badRegexPath);
    expect(loaded.files).toEqual([badJsonPath, badShapePath, badRegexPath, validPath].sort());
  });

  it('preserves manifest flags and returns all non-empty regex matches with real offsets', async () => {
    const root = makeTemporaryRoot();
    writeManifest(root, 'nested/matching.json', {
      ...validManifest,
      set: 'matching-set',
      patterns: [
        { name: 'case-sensitive', severity: 'notice', match: { string: 'Exact', flags: '' } },
        { name: 'case-insensitive', severity: 'warning', match: { string: 'token' } },
        { name: 'repeated-error', severity: 'critical', match: { regex: 'ERR+', flags: '' } },
        { name: 'empty-only', severity: 'debug', match: { regex: '(?:)' } },
      ],
    });

    const loaded = loadSignatureDirectory(root);
    const result = await run({
      input: 'Exact TOKEN\nERRR ERR\nexact only',
      watchlist: loaded.watchlist,
    });

    expect(result.records.map((record) => record.match)).toEqual(['Exact', 'TOKEN', 'ERRR', 'ERR']);
    expect(result.records.map((record) => [record.line, record.match])).toEqual([
      [1, 'Exact'],
      [1, 'TOKEN'],
      [2, 'ERRR'],
      [2, 'ERR'],
    ]);
    expect(result.records.every((record) => record.match.length > 0)).toBe(true);
    expect(result.exitCode).toBe(1);
  });
});
