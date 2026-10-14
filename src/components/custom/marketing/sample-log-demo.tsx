// @polsia:user-owned — Animated marketing demo of `samples/sample.log` in
// Signal CLI chrome. Scene timing is owned by SAMPLE_LOG_* constants so
// restyles do not drift the loop. Respects prefers-reduced-motion.
'use client';

import { type CSSProperties, useEffect, useState } from 'react';
import { SAMPLE_LOG_FADE_MS, SAMPLE_LOG_SCENE_MS, signalTheme } from '@/lib/signal-theme';
import { cn } from '@/lib/utils';

type Level = 'INFO' | 'WARN' | 'ERROR' | 'ALERT';
type Severity = 'crit' | 'high' | 'med';
type Scene = 'main' | 'search' | 'findings';

type LogLine = {
  n: number;
  ts: string;
  level: Level;
  message: string;
  finding?: Severity;
};

const LINES: LogLine[] = [
  { n: 1, ts: '2026-07-22 10:00:01', level: 'INFO', message: 'Starting AV agent service v14.2.1' },
  {
    n: 2,
    ts: '2026-07-22 10:00:02',
    level: 'INFO',
    message: 'Loaded signature database, 4102331 defs',
  },
  {
    n: 3,
    ts: '2026-07-22 10:00:05',
    level: 'WARN',
    message: 'Real-time protection module took 3200ms to initialize',
    finding: 'med',
  },
  {
    n: 4,
    ts: '2026-07-22 10:00:07',
    level: 'ERROR',
    message: 'Failed to connect to update server: timeout after 30000ms',
    finding: 'high',
  },
  {
    n: 5,
    ts: '2026-07-22 10:00:08',
    level: 'INFO',
    message: 'Retrying update server connection',
  },
  {
    n: 6,
    ts: '2026-07-22 10:00:09',
    level: 'ERROR',
    message: 'Certificate validation failed for update.example.com',
    finding: 'high',
  },
  { n: 7, ts: '2026-07-22 10:00:15', level: 'INFO', message: 'Quarantine engine ready' },
  {
    n: 8,
    ts: '2026-07-22 10:01:03',
    level: 'WARN',
    message: 'Suspicious process detected: powershell.exe -enc <base64>',
    finding: 'high',
  },
  {
    n: 9,
    ts: '2026-07-22 10:01:03',
    level: 'ALERT',
    message: 'Blocked process injection attempt targeting explorer.exe',
    finding: 'high',
  },
  {
    n: 10,
    ts: '2026-07-22 10:01:04',
    level: 'INFO',
    message: 'User acknowledged alert, process terminated',
  },
  { n: 11, ts: '2026-07-22 10:02:11', level: 'INFO', message: 'Scheduled scan started' },
  {
    n: 12,
    ts: '2026-07-22 10:05:44',
    level: 'ERROR',
    message: 'Disk I/O error while scanning C:\\Users\\jdoe\\AppData\\Local\\Temp',
    finding: 'high',
  },
  {
    n: 13,
    ts: '2026-07-22 10:05:45',
    level: 'WARN',
    message: 'Retrying scan on locked file, attempt 1',
    finding: 'med',
  },
  {
    n: 14,
    ts: '2026-07-22 10:10:00',
    level: 'INFO',
    message: 'Scheduled scan completed, 0 threats found',
  },
  {
    n: 15,
    ts: '2026-07-22 10:12:30',
    level: 'ERROR',
    message: 'License validation failed: rollback detected on system clock',
    finding: 'high',
  },
];

const SCENES: Scene[] = ['main', 'search', 'findings'];
const SELECTED = 4;
const FINDINGS = [
  { severity: 'high' as const, title: 'Certificate validation failure', loc: 'sample.log:6' },
  { severity: 'high' as const, title: 'Update server connection timeout', loc: 'sample.log:4' },
  { severity: 'high' as const, title: 'Suspicious encoded PowerShell', loc: 'sample.log:8' },
  { severity: 'high' as const, title: 'Process injection blocked', loc: 'sample.log:9' },
  { severity: 'high' as const, title: 'Disk I/O error during scan', loc: 'sample.log:12' },
  { severity: 'med' as const, title: 'Slow real-time protection init', loc: 'sample.log:3' },
  { severity: 'med' as const, title: 'Locked-file scan retry', loc: 'sample.log:13' },
];

function levelClass(level: Level): string {
  switch (level) {
    case 'INFO':
      return 'signal-tui__level--info';
    case 'WARN':
      return 'signal-tui__level--warn';
    case 'ALERT':
      return 'signal-tui__level--alert';
    default:
      return 'signal-tui__level--error';
  }
}

function Message({ line, scene }: { line: LogLine; scene: Scene }) {
  // Message text stays neutral. Only non-current search hits inside the message
  // pick up the violet fill — never keyword-tint the rest of the line.
  if (scene === 'search' && /\berror\b/i.test(line.message) && line.n !== SELECTED) {
    const parts = line.message.split(/(error)/i);
    return (
      <span className="signal-tui__msg">
        {parts.map((part, i) =>
          part.toLowerCase() === 'error' ? (
            <span key={`${line.n}-m-${i}`} className="signal-tui__match">
              {part}
            </span>
          ) : (
            <span key={`${line.n}-m-${i}`}>{part}</span>
          ),
        )}
      </span>
    );
  }

  return <span className="signal-tui__msg">{line.message}</span>;
}

function Header() {
  return (
    <div className="signal-tui__header" aria-hidden="true">
      <span className="signal-tui__brand">◆ TraceGlass</span>
      <span className="signal-tui__divider">│</span>
      <span className="signal-tui__file">sample.log (1/1)</span>
      <span className="signal-tui__divider">│</span>
      <span className="signal-tui__lens">lens general-triage</span>
      <span className="signal-tui__divider">│</span>
      <span className="signal-tui__sev">
        <span className="signal-tui__sev-dot signal-tui__sev--crit">●</span>
        <span className="signal-tui__sev--crit">0</span>
        <span> crit</span>
      </span>
      <span className="signal-tui__sev">
        <span className="signal-tui__sev-dot signal-tui__sev--high">●</span>
        <span className="signal-tui__sev--high">5</span>
        <span> high</span>
      </span>
      <span className="signal-tui__sev">
        <span className="signal-tui__sev-dot signal-tui__sev--med">●</span>
        <span className="signal-tui__sev--med">2</span>
        <span> med</span>
      </span>
    </div>
  );
}

function Status({ scene }: { scene: Scene }) {
  const mode = scene === 'search' ? 'SEARCH' : 'NORMAL';
  return (
    <div className="signal-tui__status">
      <span className="signal-tui__mode">{mode}</span>
      <span className="signal-tui__status-mid">
        7 findings · press F to review
        {scene === 'search' ? (
          <>
            {' · '}
            <span className="signal-tui__status-search">/ERROR occurrence 1 of 5</span>
          </>
        ) : null}
        {' · '}
        <span className="signal-tui__help">? help</span>
      </span>
      <span className="signal-tui__pos">Ln {SELECTED}/15 27%</span>
    </div>
  );
}

function LogBody({ scene }: { scene: Scene }) {
  const frameLabel = scene === 'search' ? 'sample.log /ERROR' : 'sample.log';
  return (
    <div className="signal-tui__frame">
      <span className="signal-tui__frame-label">{frameLabel}</span>
      <pre className="signal-tui__log">
        {LINES.map((line) => {
          const selected = line.n === SELECTED;
          const showLevelAsCurrent = scene === 'search' && selected && line.level === 'ERROR';
          return (
            <div
              key={line.n}
              className={cn('signal-tui__row', selected && 'signal-tui__row--selected')}
            >
              <span className="signal-tui__ln">{line.n}</span>
              <span
                className={cn(
                  'signal-tui__dot',
                  line.finding === 'high' && 'signal-tui__dot--high',
                  line.finding === 'med' && 'signal-tui__dot--med',
                  line.finding === 'crit' && 'signal-tui__dot--crit',
                )}
              >
                {line.finding ? '●' : ' '}
              </span>
              <span className="signal-tui__ts">{line.ts}</span>
              {showLevelAsCurrent ? (
                <span className="signal-tui__match signal-tui__match--current">{line.level}</span>
              ) : (
                <span className={cn('signal-tui__level', levelClass(line.level))}>
                  {line.level}
                </span>
              )}
              <Message line={line} scene={scene} />
            </div>
          );
        })}
      </pre>
    </div>
  );
}

function FindingsPopup() {
  return (
    <div className="signal-tui__frame" style={{ position: 'relative', minHeight: '22rem' }}>
      <div className="signal-tui__findings-backdrop" aria-hidden="true" />
      <div className="signal-tui__findings" role="dialog" aria-label="Scan findings">
        <div className="signal-tui__findings-title">
          Scan findings – 7 0 crit · 5 high · 2 med · General Triage v0.1.0
        </div>
        <div className="signal-tui__sev-bar" aria-hidden="true">
          <span style={{ width: '71%', color: signalTheme.sevHigh }} />
          <span style={{ width: '29%', color: signalTheme.sevMed }} />
        </div>
        <div className="signal-tui__filter">
          <span>filter</span>
          <span className="signal-tui__filter-chip signal-tui__filter-chip--active">all 7</span>
          <span className="signal-tui__sev signal-tui__sev--crit">CRIT 0</span>
          <span className="signal-tui__sev signal-tui__sev--high">HIGH 5</span>
          <span className="signal-tui__sev signal-tui__sev--med">MED 2</span>
          <span>f/F or ←/→</span>
        </div>
        {FINDINGS.map((f, i) => (
          <div
            key={f.loc}
            className={cn('signal-tui__finding', i === 0 && 'signal-tui__finding--selected')}
          >
            <span className={cn('signal-tui__badge', `signal-tui__badge--${f.severity}`)}>
              {f.severity.toUpperCase()}
            </span>
            <span className="signal-tui__finding-title">{f.title}</span>
            <span className="signal-tui__finding-loc">{f.loc}</span>
          </div>
        ))}
        <div className="signal-tui__detail">
          <div className="signal-tui__detail-head">
            <span className="signal-tui__badge signal-tui__badge--high">HIGH</span>
            <span className="signal-tui__detail-cat">integrity</span>
            <span className="signal-tui__detail-name">Certificate validation failure</span>
          </div>
          <div>
            <span className="signal-tui__detail-meta">id</span> cert-validation-failed
            {' · '}
            <span className="signal-tui__detail-meta">source</span> builtin
          </div>
          <div>
            TLS trust failed while contacting the update host — treat as integrity evidence and jump
            to the source line for context.
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneView({ scene }: { scene: Scene }) {
  return (
    <>
      <Header />
      {scene === 'findings' ? <FindingsPopup /> : <LogBody scene={scene} />}
      <Status scene={scene} />
    </>
  );
}

export function SampleLogDemo({ className }: { className?: string }) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setSceneIndex((i) => (i + 1) % SCENES.length);
    }, SAMPLE_LOG_SCENE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const scene = SCENES[sceneIndex] ?? 'main';

  return (
    <section
      className={cn('signal-tui', className)}
      style={
        {
          '--signal-fade-ms': `${SAMPLE_LOG_FADE_MS}ms`,
          background: signalTheme.bg,
        } as CSSProperties
      }
      data-scene={scene}
      aria-label="TraceGlass sample.log demo"
    >
      <SceneView scene={reduceMotion ? 'main' : scene} />
    </section>
  );
}
