// @polsia:user-owned — Features grid for the TraceGlass marketing page.
// Server Component. Six cards covering honest scope only.

import { ListChecks, Lock, Package, Palette, ShieldAlert, Terminal } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    icon: Terminal,
    title: 'Stdin, file, or pipe',
    body: 'Reads from stdin, a file path, or a piped stream. Drop into any shell command — tail, journalctl, kubectl logs, splunk export.',
  },
  {
    icon: ListChecks,
    title: 'Local keyword watchlist',
    body: 'Add a keyword or regex highlight explicitly to your local watchlist. The entries stay under your control, run locally, and remain separate from curated built-in signature findings.',
    badge: 'Today',
  },
  {
    icon: Palette,
    title: 'Colorized output',
    body: 'Highlights INFO in yellow, ERROR in orange, FATAL in red. Auto-disabled when stdout is not a TTY so logs stay clean when piped.',
  },
  {
    icon: ShieldAlert,
    title: 'Exit codes on critical',
    body: 'Returns 0 on clean output, 1 when a critical keyword matches. Wire it straight into CI — the build fails when the log says it should.',
  },
  {
    icon: Package,
    title: 'One-click beta installer',
    body: 'The planned TraceGlass installer verifies the signed release, installs for the current user, asks before PATH or TUI launch, and supports Linux, macOS, and Windows targets when published.',
  },
  {
    icon: Lock,
    title: 'Local-only by default',
    body: 'Runs entirely on the machine reading the log. Nothing is transmitted, no telemetry, no service, and no silent update behavior.',
  },
];

export function Features() {
  return (
    <section id="features" className="section">
      <div className="container-page flex flex-col gap-12">
        <div className="flex max-w-3xl flex-col gap-3">
          <span className="text-eyebrow">Features</span>
          <h2 className="text-h2 font-display text-balance text-foreground">
            Built for the developer who already knows what they&apos;re looking for.
          </h2>
          <p className="text-body-lg text-muted-foreground">
            No AI, no anomaly detection, no magic. You choose the keyword or regex highlights that
            belong in your local watchlist — TraceGlass makes them impossible to miss in a sea of
            10,000 lines. Curated built-in signatures scan separately.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="group lift relative overflow-hidden rounded-lg border-border/60 bg-card/60 backdrop-blur-sm"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <CardHeader className="gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md border border-border/60 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                    <Icon aria-hidden="true" className="size-4" />
                  </div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-h4">{feature.title}</CardTitle>
                    {'badge' in feature && feature.badge ? (
                      <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {feature.badge}
                      </span>
                    ) : null}
                  </div>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.body}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
