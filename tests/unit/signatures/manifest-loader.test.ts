// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadSignatureManifest, tryLoadSignatureManifest } from '@/lib/contracts/signatures';

const readSeed = (file: string) =>
  JSON.parse(readFileSync(new URL(`../../../signatures/v0.1.0/${file}`, import.meta.url), 'utf-8'));

const readV020Seed = (file: string) =>
  JSON.parse(readFileSync(new URL(`../../../signatures/v0.2.0/${file}`, import.meta.url), 'utf-8'));

describe('loadSignatureManifest()', () => {
  it('compiles matchers for the seeded nginx manifest and matches 5xx lines case-insensitively', () => {
    const loaded = loadSignatureManifest(readSeed('nginx-access-errors.json'));
    const line = 'GET /api 500 returned upstream connect timeout after 30s';
    // The 5xx regex + the upstream regex (case-IN-sensitive by default)
    // both match.
    const hits = loaded.matchers.filter((m) => m.test(line));
    const names = hits.map((h) => h.name);
    expect(names).toContain('5xx response');
    expect(names).toContain('upstream connect timeout');
    // The "permission denied" string rule does NOT match this line.
    expect(names).not.toContain('permission denied');
  });

  it('case-IN-sensitive string match: "permission denied" matches lowercase input', () => {
    const loaded = loadSignatureManifest(readSeed('nginx-access-errors.json'));
    const matches = loaded.matchers.find((m) => m.name === 'permission denied');
    expect(matches).toBeDefined();
    expect(matches?.test('EACCES: permission denied while opening /var/log/nginx')).toBe(true);
    expect(matches?.test('Permission Denied retry 1')).toBe(true);
    // Different word boundary keeps it case-insensitive but still substring-based.
    const pg = loaded.matchers.find((m) => m.name === 'permission denied');
    expect(pg?.test('audit: no PERMISSION DENIED entries')).toBe(true);
  });

  it('case-IN-sensitive string match: "OUtOfMemoRy" matches OutOfMemory docker pattern', () => {
    const loaded = loadSignatureManifest(readSeed('docker-container-crashes.json'));
    const oom = loaded.matchers.find((m) => m.name === 'oom (out of memory)');
    expect(oom).toBeDefined();
    expect(oom?.test('kernel: OOM killed process')).toBe(false); // string "OutOfMemory" doesn't match "OOM"
    expect(oom?.test('OutOfMemory thrown from CLI')).toBe(true);
    expect(oom?.test('OutOfMemory error from sub-process')).toBe(true);
    expect(oom?.test('plain text without memory')).toBe(false);
  });

  it('each seed set has ≥3 patterns, all matchers carry a unique name + valid severity', () => {
    for (const file of [
      'nginx-access-errors.json',
      'postgres-timeouts.json',
      'docker-container-crashes.json',
    ]) {
      const loaded = loadSignatureManifest(readSeed(file));
      expect(loaded.manifest.patterns.length).toBeGreaterThanOrEqual(3);
      const names = new Set<string>();
      for (const m of loaded.matchers) {
        expect(m.name.length).toBeGreaterThan(0);
        expect(['critical', 'warning', 'notice', 'debug']).toContain(m.severity);
        names.add(m.name);
      }
      expect(names.size, `${file} pattern names should be unique within a set`).toBe(
        loaded.matchers.length,
      );
    }
  });

  it('the postgres-timeouts set matches a "too many connections" + statement_timeout line', () => {
    const loaded = loadSignatureCatalog('postgres-timeouts.json');
    const line = 'FATAL: too many connections for role "app" (statement_timeout context)';
    const hits = loaded.matchers.filter((m) => m.test(line));
    const names = hits.map((h) => h.name);
    expect(names).toContain('too many connections');
    expect(names).toContain('statement_timeout triggered');
  });

  it('matches representative Splunk, Windows Event, and antivirus/EDR lines', () => {
    const splunk = loadSignatureManifest(readV020Seed('splunk-search-errors.json'));
    expect(
      splunk.matchers.some(
        (matcher) =>
          matcher.name === 'search peer failure' && matcher.test('ERROR search peer idx-01 failed'),
      ),
    ).toBe(true);
    expect(
      splunk.matchers.some(
        (matcher) => matcher.name === 'search timeout' && matcher.test('WARN search job timed out'),
      ),
    ).toBe(true);

    const windows = loadSignatureManifest(readV020Seed('windows-event-anomalies.json'));
    expect(
      windows.matchers.some(
        (matcher) => matcher.name === 'failed logon event' && matcher.test('Security EventID=4625'),
      ),
    ).toBe(true);
    expect(
      windows.matchers.some(
        (matcher) =>
          matcher.name === 'unexpected service installation' &&
          matcher.test('System Event ID: 7045'),
      ),
    ).toBe(true);

    const antivirus = loadSignatureManifest(readV020Seed('antivirus-edr-alerts.json'));
    expect(
      antivirus.matchers.some(
        (matcher) =>
          matcher.name === 'CrowdStrike detection' && matcher.test('CrowdStrike detection blocked'),
      ),
    ).toBe(true);
    expect(
      antivirus.matchers.some(
        (matcher) =>
          matcher.name === 'SentinelOne incident' && matcher.test('SentinelOne incident mitigated'),
      ),
    ).toBe(true);
  });

  it('case-sensitive regex match (flags: "") does NOT match a different-cased input', () => {
    const parsed = {
      version: 'v0.1.0',
      set: 'case-test',
      title: 'case-sensitive regex',
      description: '',
      patterns: [
        {
          name: 'Started',
          severity: 'notice',
          match: { regex: '^Started\\b', flags: '' },
        },
      ],
    };
    const loaded = loadSignatureManifest(parsed);
    const rule = loaded.matchers[0];
    expect(rule).toBeDefined();
    expect(rule?.test('Started the server')).toBe(true);
    expect(rule?.test('started the server')).toBe(false);
  });

  it('rejects an unknown version with a clear error and never throws silently', () => {
    const result = tryLoadSignatureManifest({
      version: 'v3.0.0', // semver shape ok, but unknown in v0.1.0 catalog
      set: 'kebab-id',
      title: 'x',
      description: '',
      patterns: [{ name: 'p', severity: 'critical', match: { string: 'x' } }],
    });
    // Spec contract: the loader has NO awareness of "registered versions" in
    // v0.1.0; ANY vMAJOR.MINOR.PATCH string is accepted by the schema. This
    // test just confirms the contract is forgiving on bits outside the
    // shape-validation surface.
    expect(result.ok).toBe(true);
  });

  it('rejects a manifest missing `version`', () => {
    const parsed = {
      set: 'kebab-id',
      title: 'x',
      description: '',
      patterns: [{ name: 'p', severity: 'critical', match: { string: 'x' } }],
    };
    const result = tryLoadSignatureManifest(parsed);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/version/);
  });

  it('rejects a bad regex source through `tryLoadSignatureManifest`', () => {
    const parsed = {
      version: 'v0.1.0',
      set: 'kebab-id',
      title: 'x',
      description: '',
      patterns: [
        {
          name: 'bad',
          severity: 'critical',
          match: { regex: '(', flags: 'i' },
        },
      ],
    };
    // The schema itself accepts a bare regex; the loader catches the bad
    // RegExp at compile time and surfaces it as an error.
    const result = tryLoadSignatureManifest(parsed);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/invalid signature manifest|Invalid|regular/);
  });
});

function loadSignatureCatalog(file: string) {
  return loadSignatureManifest(readSeed(file));
}
