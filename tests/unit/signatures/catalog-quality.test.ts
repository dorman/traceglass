// @polsia:user-owned
// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSignatureManifest as loadSharedManifest, SignatureManifest } from '@/lib/contracts/signatures';

const { loadSignatureManifest: loadCliManifest, tryLoadSignatureManifest } =
  await import('../../../cli/signatures.mjs');

const catalogRoots = ['v0.1.0', 'v0.2.0'];

function catalogFiles(version: string) {
  return readdirSync(join(process.cwd(), 'signatures', version))
    .filter((file) => file.endsWith('.json') && file !== 'schema.json')
    .sort()
    .map((file) => join(process.cwd(), 'signatures', version, file));
}

function readCatalog() {
  return catalogRoots.flatMap((catalogVersion) =>
    catalogFiles(catalogVersion).map((file) => ({
      catalogVersion,
      file,
      value: JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>,
    })),
  );
}

describe('trusted shipped signature catalog', () => {
  it('requires complete metadata, unique IDs, and positive/negative fixtures for every pattern', () => {
    const ids = new Map<string, string>();
    for (const { catalogVersion, file, value } of readCatalog()) {
      const parsed = SignatureManifest.safeParse(value);
      expect(parsed.success, `${file}: ${JSON.stringify(parsed)}`).toBe(true);
      if (!parsed.success) continue;

      const loaded = loadCliManifest(value);
      expect(loaded.trust, `${file} must be trusted`).toBe('builtin');
      const shared = loadSharedManifest(value);
      expect(shared.trust).toBe('builtin');
      for (const pattern of parsed.data.patterns) {
        const key = `${catalogVersion}/${parsed.data.set}/${pattern.id}`;
        expect(ids.has(key), `${file}: duplicate ${key}`).toBe(false);
        ids.set(key, file);

        const matcher = shared.matchers.find((candidate) => candidate.id === pattern.id);
        expect(matcher, `${file}: matcher missing ${pattern.id}`).toBeDefined();
        expect(matcher?.test(pattern.examples?.positive ?? '')).toBe(true);
        expect(matcher?.test(pattern.examples?.negative ?? '')).toBe(false);
        expect(matcher?.provenance).toMatchObject({
          source: 'builtin',
          trust: 'trusted',
          id: pattern.id,
          version: parsed.data.version,
          set: parsed.data.set,
          pattern: pattern.name,
        });
      }
    }
    expect(ids.size).toBe(41);
  });

  it('allows exact carry-forward IDs across catalog versions but rejects identity collisions', () => {
    const identities = new Map<string, string>();
    for (const { file, value } of readCatalog()) {
      const parsed = SignatureManifest.parse(value);
      for (const pattern of parsed.patterns) {
        const identity = JSON.stringify({
          set: parsed.set,
          name: pattern.name,
          match: pattern.match,
        });
        const previous = identities.get(pattern.id!);
        if (previous !== undefined) {
          expect(identity, `${file}: ID ${pattern.id} changed identity`).toBe(previous);
        } else {
          identities.set(pattern.id!, identity);
        }
      }
    }
    expect(identities.size).toBe(27);
  });

  it('keeps malformed or legacy external manifests out of trusted provenance', () => {
    const legacy = {
      version: 'v9.9.9',
      set: 'external-legacy',
      title: 'Legacy external set',
      description: 'Old shape retained for compatibility.',
      patterns: [{ name: 'old', severity: 'warning', match: { string: 'OLD' } }],
    };
    expect(loadCliManifest(legacy).trust).toBe('legacy');
    expect(loadCliManifest(legacy).entries[0]?.source).toBe('legacy_external');

    const partial = {
      ...legacy,
      patterns: [
        {
          name: 'partial',
          severity: 'warning',
          id: 'partial-id',
          match: { string: 'PARTIAL' },
        },
      ],
    };
    expect(tryLoadSignatureManifest(partial).ok).toBe(false);
  });
});
