// @polsia:user-owned
//
// Faux macOS terminal shell used by the TraceGlass marketing page demos. Renders a
// faux window chrome (traffic lights + header strip + monospace panel) around
// React children that contain the actual log lines. Server Component — no data,
// no effects, no 'use client'. The wrapped `<div className="dark">` forces the
// panel to read dark even on a light page; tokens are the raw zinc palette so
// the demo isn't tied to the brand seed.

import type * as React from 'react';
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
      className={cn(
        'overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl shadow-black/40 dark',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/70 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-full bg-zinc-700" />
          <span aria-hidden="true" className="size-3 rounded-full bg-zinc-700" />
          <span aria-hidden="true" className="size-3 rounded-full bg-zinc-700" />
        </div>
        {!compact ? (
          <div className="ml-3 flex min-w-0 flex-1 items-center gap-2 text-[11px] font-medium text-zinc-400">
            <span className="truncate font-mono">{title}</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-start gap-2 border-b border-zinc-800/70 bg-zinc-950 px-4 py-2 font-mono text-[12px] text-zinc-300">
        <span aria-hidden="true" className="select-none text-zinc-500">
          ❯
        </span>
        <span className="break-all">{prompt}</span>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-[1.65] text-zinc-200">
        {children}
      </pre>
    </div>
  );
}
