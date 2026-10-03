// @polsia:user-owned — How-it-works 3-step explainer.
// Server Component. Terminal demos for each step.

import { Terminal } from '@/components/custom/terminal';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const steps = [
  {
    n: '01',
    title: 'Add to your local watchlist',
    body: 'Press a for a keyword highlight or r for a regex highlight. Enter adds the user-controlled entry to the local watchlist; built-in signatures remain a separate scan catalog.',
    prompt: '$ cat loglens.toml',
    code: (
      <code className="block">
        <span className="block text-zinc-500">{'{'}</span>
        <span className="block">
          <span className="text-zinc-500">{'"keywords"'}</span>
          <span className="text-zinc-400">: [</span>
        </span>
        <span className="block pl-4">
          <span className="text-zinc-500">{'"FATAL"'}</span>
          <span className="text-zinc-400">, </span>
          <span className="text-zinc-500">{'"panic"'}</span>
          <span className="text-zinc-400">, </span>
          <span className="text-zinc-500">{'"OOMKilled"'}</span>
        </span>
        <span className="block text-zinc-400">]</span>
        <span className="block text-zinc-500">{'}'}</span>
      </code>
    ),
  },
  {
    n: '02',
    title: 'Pipe in your logs',
    body: 'Anything that already produces logs works — tail, journalctl, docker logs, kubectl, a CSV export, a file path.',
    prompt: '$ kubectl logs api-x | loglens --watchlist loglens.toml',
    code: (
      <code className="block">
        <span className="block whitespace-pre">
          <span className="text-zinc-500">I0712 14:01:02 kubelet: </span>
          <span className="bg-yellow-500/20 font-semibold text-yellow-300">INFO</span>
          <span className="text-zinc-200"> container started</span>
        </span>
        <span className="block whitespace-pre">
          <span className="text-zinc-500">E0712 14:01:09 kubelet: </span>
          <span className="bg-orange-500/25 font-semibold text-orange-300">OOMKilled</span>
          <span className="text-zinc-200"> memory limit 512Mi exceeded</span>
        </span>
        <span className="block whitespace-pre text-zinc-500">{'... 142 lines ...'}</span>
      </code>
    ),
  },
  {
    n: '03',
    title: 'Get highlights, findings + an exit code',
    body: 'Colorized output goes to your terminal. A summary line reports the counts. Exit 0 on clean, exit 1 when critical matches — wire straight into CI.',
    prompt: '$ echo $?',
    code: (
      <code className="block">
        <span className="block whitespace-pre text-zinc-500">
          counts: lines=143 critical=1 warnings=2
        </span>
        <span className="block whitespace-pre pt-2">
          <span className="text-zinc-500">$ </span>
          <span className="text-zinc-400">echo $?</span>
        </span>
        <span className="block whitespace-pre bg-red-500/15 font-bold text-red-400">1</span>
      </code>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="workflow" className="section">
      <div className="container-page flex flex-col gap-12">
        <div className="flex max-w-3xl flex-col gap-3">
          <span className="text-eyebrow">How it works</span>
          <h2 className="text-h2 font-display text-balance text-foreground">
            Three steps. Zero setup.
          </h2>
          <p className="text-body-lg text-muted-foreground">
            Same shape as{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.95em]">grep</code>,
            but with a curated keyword list and a build-friendly exit code.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {steps.map((step) => (
            <Card
              key={step.n}
              className="flex flex-col gap-0 overflow-hidden border-border/60 bg-card/80 p-0"
            >
              <CardHeader className="gap-2 border-b border-border/60 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-md border border-brand-300/60 bg-brand-50 font-mono text-sm font-semibold text-brand-700 dark:border-brand-700/60 dark:bg-brand-900/40 dark:text-brand-300">
                    {step.n}
                  </span>
                  <CardTitle className="text-h4 font-display">{step.title}</CardTitle>
                </div>
                <CardDescription className="text-sm leading-relaxed">{step.body}</CardDescription>
              </CardHeader>
              <div className="p-3">
                <Terminal prompt={step.prompt} title="~/.loglens" compact className="text-[11.5px]">
                  {step.code}
                </Terminal>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
