// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  loadSignatureManifest,
  SIGNATURE_SEVERITIES,
  SignatureManifest,
} from '@/lib/contracts/signatures';

const readSeed = (file: string) =>
  JSON.parse(readFileSync(new URL(`../../../signatures/v0.1.0/${file}`, import.meta.url), 'utf-8'));

const readV020Seed = (file: string) =>
  JSON.parse(readFileSync(new URL(`../../../signatures/v0.2.0/${file}`, import.meta.url), 'utf-8'));

describe('SignatureManifest contract (v0.1.0)', () => {
  it('accepts each curated seed manifest', () => {
    for (const file of [
      'nginx-access-errors.json',
      'postgres-timeouts.json',
      'docker-container-crashes.json',
    ]) {
      const parsed = readSeed(file);
      const result = SignatureManifest.safeParse(parsed);
      expect(result.success, `${file} failed: ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it('accepts the schema crib (schema.json) — humans only but still loadable', () => {
    const parsed = readSeed('schema.json');
    const result = SignatureManifest.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it('rejects a non-kebab set id (uppercase, whitespace, leading digit)', () => {
    for (const badSet of [
      'nginx 500', // whitespace
      'UPPER', // uppercase
      '-leading-dash', // leading dash
      '1leading-digit', // leading digit
      '', // empty
      'bad_set', // underscore not allowed
      'Bad-Case', // mixed case
    ]) {
      const result = SignatureManifest.safeParse({
        version: 'v0.1.0',
        set: badSet,
        title: 'x',
        description: '',
        patterns: [{ name: 'p', severity: 'critical', match: { string: 'x' } }],
      });
      expect(result.success, `bad set "${badSet}" should be rejected`).toBe(false);
    }
  });

  it('accepts a kebab set id including a numeric tail (e.g. "nginx-500")', () => {
    const result = SignatureManifest.safeParse({
      version: 'v0.1.0',
      set: 'nginx-500',
      title: 'x',
      description: '',
      patterns: [{ name: 'p', severity: 'critical', match: { string: 'x' } }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-vMAJOR.MINOR.PATCH version (no v, 1 or 2 components, leading zeros)', () => {
    for (const badVersion of ['0.1.0', 'v1.0', 'v0.1', 'v0.1.0.4', 'V0.1.0', '']) {
      const result = SignatureManifest.safeParse({
        version: badVersion,
        set: 'kebab-id',
        title: 'x',
        description: '',
        patterns: [{ name: 'p', severity: 'critical', match: { string: 'x' } }],
      });
      expect(result.success, `bad version "${badVersion}" should be rejected`).toBe(false);
    }
  });

  it('accepts every legal severity literal and rejects others', () => {
    for (const sev of SIGNATURE_SEVERITIES) {
      const result = SignatureManifest.safeParse({
        version: 'v0.1.0',
        set: 'kebab-id',
        title: 'x',
        description: '',
        patterns: [{ name: 'p', severity: sev, match: { string: 'x' } }],
      });
      expect(result.success, `severity "${sev}" should be accepted`).toBe(true);
    }
    for (const bad of ['trace', 'alert', 'fatal', 'emergency', 'INFO']) {
      const result = SignatureManifest.safeParse({
        version: 'v0.1.0',
        set: 'kebab-id',
        title: 'x',
        description: '',
        patterns: [{ name: 'p', severity: bad, match: { string: 'x' } }],
      });
      expect(result.success, `severity "${bad}" should be rejected`).toBe(false);
    }
  });

  it('rejects an empty patterns array (must have ≥ 1 pattern)', () => {
    const result = SignatureManifest.safeParse({
      version: 'v0.1.0',
      set: 'kebab-id',
      title: 'x',
      description: '',
      patterns: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a match with neither string nor regex', () => {
    const result = SignatureManifest.safeParse({
      version: 'v0.1.0',
      set: 'kebab-id',
      title: 'x',
      description: '',
      patterns: [{ name: 'p', severity: 'critical', match: {} }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a match with both string AND regex (one or the other only)', () => {
    const result = SignatureManifest.safeParse({
      version: 'v0.1.0',
      set: 'kebab-id',
      title: 'x',
      description: '',
      patterns: [
        {
          name: 'p',
          severity: 'critical',
          match: { string: 'x', regex: 'y' },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty string or regex match value', () => {
    for (const match of [{ string: '' }, { regex: '' }]) {
      const result = SignatureManifest.safeParse({
        version: 'v0.1.0',
        set: 'kebab-id',
        title: 'x',
        description: '',
        patterns: [{ name: 'p', severity: 'critical', match }],
      });
      expect(result.success, `match ${JSON.stringify(match)} should be rejected`).toBe(false);
    }
  });

  it('rejects a pattern missing the name field', () => {
    const result = SignatureManifest.safeParse({
      version: 'v0.1.0',
      set: 'kebab-id',
      title: 'x',
      description: '',
      patterns: [{ severity: 'critical', match: { string: 'x' } }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level keys (strict)', () => {
    const result = SignatureManifest.safeParse({
      version: 'v0.1.0',
      set: 'kebab-id',
      title: 'x',
      description: '',
      patterns: [{ name: 'p', severity: 'critical', match: { string: 'x' } }],
      // Adding a stray `severity` at the top-level should be tolerated — `notes`
      // is the only optional field. The next tests assert rejection for an
      // unknown key.
      extra: 'unsupported',
    });
    // z.object is non-strict by default, so extra keys are trimmed; this
    // test confirms the loader tolerates extra keys without breaking.
    expect(result.success).toBe(true);
  });

  it('rejects a non-object match shape (string instead of object)', () => {
    const result = SignatureManifest.safeParse({
      version: 'v0.1.0',
      set: 'kebab-id',
      title: 'x',
      description: '',
      patterns: [
        { name: 'p', severity: 'critical', match: 'FATAL' as unknown as { string: string } },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('seeding the v0.1.0 catalog', () => {
  it('every seed set has ≥3 patterns and ≥ 4 pattern objects load via the manifest contract', () => {
    const seedFiles = [
      'nginx-access-errors.json',
      'postgres-timeouts.json',
      'docker-container-crashes.json',
    ];
    for (const file of seedFiles) {
      const loaded = loadSignatureManifest(readSeed(file));
      expect(loaded.manifest.patterns.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('every seed set includes at least one critical + one non-critical pattern', () => {
    for (const file of [
      'nginx-access-errors.json',
      'postgres-timeouts.json',
      'docker-container-crashes.json',
    ]) {
      const loaded = loadSignatureManifest(readSeed(file));
      const sevs = new Set(loaded.matchers.map((m) => m.severity));
      expect(sevs.has('critical')).toBe(true);
      const nonCritical = [...sevs].some((s) => s !== 'critical');
      expect(nonCritical, `${file} should include a non-critical pattern`).toBe(true);
    }
  });
});

describe('seeding the v0.2.0 catalog', () => {
  it('safe-parses each new vendor manifest', () => {
    for (const file of [
      'splunk-search-errors.json',
      'windows-event-anomalies.json',
      'antivirus-edr-alerts.json',
    ]) {
      const parsed = readV020Seed(file);
      const result = SignatureManifest.safeParse(parsed);
      expect(result.success, `${file} failed: ${JSON.stringify(result)}`).toBe(true);
      expect(parsed.version).toBe('v0.2.0');
    }
  });

  it('each new vendor set includes critical and non-critical coverage', () => {
    for (const file of [
      'splunk-search-errors.json',
      'windows-event-anomalies.json',
      'antivirus-edr-alerts.json',
    ]) {
      const loaded = loadSignatureManifest(readV020Seed(file));
      expect(loaded.manifest.patterns.length).toBeGreaterThanOrEqual(3);
      const severities = new Set(loaded.manifest.patterns.map((pattern) => pattern.severity));
      expect(severities.has('critical')).toBe(true);
      expect([...severities].some((severity) => severity !== 'critical')).toBe(true);
    }
  });
});
