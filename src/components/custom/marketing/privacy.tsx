// @polsia:user-owned — Privacy callout section.
// Server Component. Single centered card with the local-only positioning.

import { Lock, ShieldCheck } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function Privacy() {
  return (
    <section id="privacy" className="section">
      <div className="container-page flex justify-center">
        <Card className="relative w-full max-w-3xl overflow-hidden border-brand-200/60 bg-gradient-to-br from-brand-50 via-background to-background dark:border-brand-800/40 dark:from-brand-900/20">
          <span
            aria-hidden="true"
            className="absolute -right-24 -top-24 size-64 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-500/20"
          />
          <CardHeader className="relative gap-4 p-8 sm:p-10">
            <div className="flex size-12 items-center justify-center rounded-xl border border-brand-400/40 bg-background/80 text-brand-700 dark:text-brand-300">
              <Lock aria-hidden="true" className="size-6" />
            </div>
            <CardTitle className="text-h2 font-display text-balance">
              Nothing leaves your machine.
            </CardTitle>
            <CardDescription className="max-w-2xl text-body-lg text-muted-foreground">
              TraceGlass is a local CLI. Your log content, your stack traces, your PII — all of it
              stays in the pipe between the source command and your terminal. There is no hosted
              backend, no analytics, no opt-in telemetry. Even crash reports are written locally.
            </CardDescription>

            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, label: 'No network calls' },
                { icon: Lock, label: 'No cloud dashboard' },
                { icon: ShieldCheck, label: 'No telemetry' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm font-medium text-foreground/80"
                >
                  <Icon aria-hidden="true" className="size-4 text-brand-600 dark:text-brand-400" />
                  {label}
                </div>
              ))}
            </div>
          </CardHeader>
        </Card>
      </div>
    </section>
  );
}
