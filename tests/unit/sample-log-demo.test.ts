import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { __sampleLogDemoTest } from '@/components/custom/marketing/sample-log-demo';

const sampleLog = readFileSync('traceglass/samples/sample.log', 'utf8');

describe('SampleLogDemo data', () => {
  it('keeps every sample.log line literal, including angle brackets and backslashes', () => {
    const fileLines = sampleLog.replace(/\n$/, '').split('\n');
    expect(__sampleLogDemoTest.LINES).toHaveLength(fileLines.length);

    for (let i = 0; i < fileLines.length; i += 1) {
      const raw = fileLines[i];
      const demo = __sampleLogDemoTest.LINES[i];
      expect(raw).toBeDefined();
      expect(demo).toBeDefined();
      if (!raw || !demo) continue;
      expect(raw.startsWith(demo.ts)).toBe(true);
      expect(raw).toContain(demo.level);
      expect(raw.endsWith(demo.message) || raw.includes(` ${demo.message}`)).toBe(true);
      expect(demo.message).toBe(raw.slice(raw.indexOf(demo.level) + demo.level.length).trim());
    }

    const line8 = __sampleLogDemoTest.LINES.find((l) => l.n === 8);
    expect(line8?.message).toContain('<base64>');
    expect(line8?.message).toBe('Suspicious process detected: powershell.exe -enc <base64>');

    const line12 = __sampleLogDemoTest.LINES.find((l) => l.n === 12);
    expect(line12?.message).toContain('\\Users\\');
  });

  it('lists the same 7 CLI findings (5 HIGH + 2 MED) with honest locations', () => {
    const { FINDINGS } = __sampleLogDemoTest;
    expect(FINDINGS).toHaveLength(7);
    expect(FINDINGS.filter((f) => f.severity === 'high')).toHaveLength(5);
    expect(FINDINGS.filter((f) => f.severity === 'med')).toHaveLength(2);

    expect(FINDINGS.map((f) => `${f.severity}:${f.title}:${f.loc}`)).toEqual([
      'high:Certificate validation failure:sample.log:6',
      'high:Encoded PowerShell command:sample.log:8',
      'high:Process injection / hollowing:sample.log:9',
      'high:Resource exhaustion:sample.log:12',
      'high:Clock / time rollback detected:sample.log:15',
      'med:Update failure:sample.log:4',
      'med:Installer rollback:sample.log:15',
    ]);

    for (const f of FINDINGS) {
      expect(f.id).toBeTruthy();
      expect(f.source).toBe('builtin');
      expect(f.rationale.length).toBeGreaterThan(20);
      expect(f.description.length).toBeGreaterThan(20);
    }
  });
});
