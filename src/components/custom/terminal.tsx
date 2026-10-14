// @polsia:user-owned
//
// Signal CLI chrome shell for TraceGlass marketing demos. Matches Direction B
// palette from `traceglass/src/theme.rs` (see `src/lib/signal-theme.ts`): teal
// brand header, one dashed accent frame around the log body, monospace on the
// Signal ground. Server Component — no data, no effects, no 'use client'.

import type * as React from 'react';
import { signalTheme } from '@/lib/signal-theme';
import { cn } from '@/lib/utils';

export interface TerminalProps {
  /** The prompt shown on the title bar (e.g. "$ traceglass --watchlist …"). */
  prompt?: string;
  /** Optional short label on the title bar (e.g. "docker-compose.log"). */
  title?: string;
  /** Hide the title bar (useful when the prompt already lives outside). */
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function Terminal({
  prompt = '$ traceglass --watchlist traceglass.toml < docker-compose.log',
  title = 'docker-compose.log',
  compact = false,
  className,
  children,
}: TerminalProps) {
  return (
    <div
      className={cn('signal-tui dark', className)}
      style={{ background: signalTheme.bg, color: signalTheme.text }}
    >
      <div className="signal-tui__header">
        <span className="signal-tui__brand">◆ TraceGlass</span>
        <span className="signal-tui__divider">│</span>
        {!compact ? (
          <>
            <span className="signal-tui__file">{title}</span>
            <span className="signal-tui__divider">│</span>
          </>
        ) : (
          <span className="signal-tui__file">{title}</span>
        )}
        <span className="signal-tui__lens truncate">{prompt}</span>
      </div>
      <div className="signal-tui__frame">
        <span className="signal-tui__frame-label">{title}</span>
        <pre
          className="signal-tui__log"
          style={{ color: signalTheme.text, padding: '0.35rem 0.25rem' }}
        >
          {children}
        </pre>
      </div>
      <div className="signal-tui__status">
        <span className="signal-tui__mode">NORMAL</span>
        <span className="signal-tui__status-mid">
          <span className="signal-tui__help">? help</span>
        </span>
      </div>
    </div>
  );
}
