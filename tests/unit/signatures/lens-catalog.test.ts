import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { validateLensCatalog } from '@/lib/contracts/lenses';

const { loadLensCatalog, lensPlacement, selectLens } = await import('../../../cli/lenses.mjs');

const catalog = JSON.parse(
  readFileSync(resolve(process.cwd(), 'loglens/lenses/v0.1.0/catalog.json'), 'utf8'),
) as unknown;

const rustIds = [
  'tamper-protection-disabled',
  'powershell-encoded-command',
  'process-injection-hollowing',
  'lolbin-execution',
  'system-clock-rollback',
  'certificate-validation-failure',
  'signature-database-corrupt',
  'fatal-error-crash',
  'resource-exhaustion',
  'connection-refused-reset',
  'update-failure',
  'installer-rollback',
  'access-denied-unauthorized',
  'container-runtime-failure',
  'kubernetes-workload-failure',
  'systemd-unit-failure',
  'nginx-upstream-failure',
  'mysql-storage-concurrency-failure',
  'postgresql-connection-transaction-failure',
  'windows-event-audit-service-failure',
  'edr-alert',
  'splunk-search-indexer-failure',
  'diagnostic-assertion-traceback',
];

const jsonIds = [
  'docker-container-non-zero-exit',
  'docker-container-out-of-memory',
  'docker-container-oci-exec-failed',
  'docker-container-go-panic',
  'docker-container-restarting',
  'nginx-5xx-response',
  'nginx-upstream-connect-timeout',
  'nginx-permission-denied',
  'nginx-client-disconnected',
  'postgres-statement-timeout',
  'postgres-connection-timeout',
  'postgres-too-many-connections',
  'postgres-deadlock',
  'postgres-lock-timeout',
  'av-threat-detected',
  'crowdstrike-detection',
  'sentinelone-incident',
  'defender-remediation',
  'av-signatures-updated',
  'splunk-search-peer-failure',
  'splunk-search-timeout',
  'splunk-search-bundle-init',
  'splunk-license-violation',
  'windows-failed-logon',
  'windows-audit-log-cleared',
  'windows-service-installed',
  'windows-system-time-changed',
];

const inventory = [
  ...rustIds.map((id) => ({ source: 'rust_builtin' as const, id })),
  ...jsonIds.map((id) => ({ source: 'json_manifest' as const, id })),
];

describe('deterministic lens catalog', () => {
  it('validates the shipped version and every reviewed reference', () => {
    const result = validateLensCatalog(catalog, inventory);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.version).toBe('v0.1.0');
    expect(result.value.lenses.map((lens) => lens.id)).toEqual([
      'general-triage',
      'incident-reliability',
      'security-signals',
    ]);
  });

  it('keeps stable groups and an explicit fallback for unsupported evidence', () => {
    const result = validateLensCatalog(catalog, inventory);
    if (!result.ok) throw new Error(result.error);
    for (const lens of result.value.lenses) {
      expect(lens.groups.filter((group) => group.fallback)).toHaveLength(1);
      expect(lens.groups.map((group) => group.priority)).toEqual(
        [...lens.groups].map((group) => group.priority).sort((a, b) => a - b),
      );
    }
  });

  it('rejects duplicate references and unknown inventory identities', () => {
    const duplicate = structuredClone(catalog) as { lenses: Array<{ groups: Array<{ references: unknown[] }> }> };
    duplicate.lenses[0]!.groups[0]!.references.push(duplicate.lenses[0]!.groups[0]!.references[0]!);
    expect(validateLensCatalog(duplicate, inventory).ok).toBe(false);

    const unknown = structuredClone(catalog) as { lenses: Array<{ groups: Array<{ references: Array<{ source: string; id: string }> }> }> };
    unknown.lenses[0]!.groups[0]!.references[0] = { source: 'rust_builtin', id: 'future-signal' };
    expect(validateLensCatalog(unknown, inventory).ok).toBe(false);
  });

  it('keeps Node compatibility placement deterministic and explicit for legacy evidence', () => {
    const loaded = loadLensCatalog();
    const selection = selectLens('incident-reliability', loaded);
    expect(lensPlacement(selection, 'json_manifest', 'postgres-connection-timeout')).toMatchObject({
      group: 'availability-dependency',
      priority: 10,
    });
    expect(lensPlacement(selection, 'legacy_external', 'future-signal').group).toBe('other-evidence');
  });
});
