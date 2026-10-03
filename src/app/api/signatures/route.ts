// @polsia:user-owned — public read-only preview of the versioned signature catalog.
import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import {
  loadSignatureManifest,
  SIGNATURE_SEVERITIES,
  SignatureCatalogResponse,
} from '@/lib/contracts/signatures';
import { canonicalRepositoryBlobUrl } from '@/lib/repository';

export const dynamic = 'force-dynamic';

const SIGNATURE_FILES = [
  'splunk-search-errors.json',
  'windows-event-anomalies.json',
  'antivirus-edr-alerts.json',
] as const;

type SignatureFile = (typeof SIGNATURE_FILES)[number];

const SAMPLE_LINES: Record<SignatureFile, readonly [string, string, string]> = {
  'splunk-search-errors.json': [
    'ERROR search peer idx-01 failed to respond',
    'WARN Search job sid=1742 timed out after 300 seconds',
    'ERROR Unable to initialize search bundle',
  ],
  'windows-event-anomalies.json': [
    'Security EventID=4625: An account failed to log on',
    'System Event ID: 7045: A new service was installed',
    'The system time has changed',
  ],
  'antivirus-edr-alerts.json': [
    'Microsoft Defender Threat detected: Trojan:Win32/Example',
    'CrowdStrike detection prevented execution of suspicious.exe',
    'SentinelOne incident mitigated on endpoint WIN-042',
  ],
};

const SIGNATURES_DIR = join(process.cwd(), 'signatures', 'v0.2.0');

export function GET() {
  try {
    const sets = SIGNATURE_FILES.map((file) => {
      const parsed: unknown = JSON.parse(readFileSync(join(SIGNATURES_DIR, file), 'utf8'));
      const manifest = loadSignatureManifest(parsed).manifest;
      const severity =
        SIGNATURE_SEVERITIES.find((candidate) =>
          manifest.patterns.some((pattern) => pattern.severity === candidate),
        ) ?? 'debug';

      return {
        set: manifest.set,
        title: manifest.title,
        description: manifest.description,
        version: manifest.version,
        severity,
        sample: [...SAMPLE_LINES[file]],
        manifestHref: canonicalRepositoryBlobUrl(`signatures/v0.2.0/${manifest.set}.json`),
      };
    });

    const payload = SignatureCatalogResponse.parse({
      eyebrow: 'Open-source detection sets',
      heading: 'A shared vocabulary for noisy logs.',
      intro:
        'The v0.2.0 signature library adds Splunk, Windows Event, and antivirus/EDR detection sets to the carried-forward operational signals that deserve a closer look.',
      version: 'v0.2.0',
      sets,
    });

    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
