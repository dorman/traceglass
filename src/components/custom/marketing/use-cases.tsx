// @polsia:user-owned — "Built for" use cases section.
// Server Component. Five cards, each with a sample terminal block.

import { Terminal } from '@/components/custom/terminal';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const useCases = [
  {
    id: 'splunk',
    label: 'Splunk exports',
    description:
      'Pipe a CSV export and let TraceGlass flag every INFO that says "ready", against the FATALs you actually worried about.',
    title: 'splunk-export.log',
    prompt: '$ loglens --watchlist loglens.toml < splunk-export.log',
    lines: [
      { tone: 'muted', text: 'host=web-01  level=' },
      { tone: 'info', text: 'INFO' },
      { tone: 'plain', text: '  Service ' },
      { tone: 'plain-soft', text: '"payments-api"' },
      { tone: 'plain', text: ' ready' },
    ],
    tailNote: 'counts: critical=2 errors=7',
  },
  {
    id: 'docker',
    label: 'Docker Compose',
    description:
      'L2 reading noisy compose logs at midnight — the FATAL line in red is the only thing that matters, and now it has a count.',
    title: 'docker-compose.log',
    prompt: '$ docker compose logs -t | loglens',
    lines: [
      { tone: 'muted', text: 'api-gateway-1   | ' },
      { tone: 'info', text: 'INFO' },
      { tone: 'plain', text: '  Server ready on :8080' },
    ],
    extra: [
      { tone: 'muted', text: 'payments-api-x  | ' },
      { tone: 'fatal', text: 'FATAL' },
      { tone: 'plain', text: '  NullPointerException at CheckoutService.charge:142' },
    ],
    tailNote: 'counts: critical=1 info=1',
  },
  {
    id: 'av',
    label: 'Antivirus diagnostic logs',
    description:
      "A flag the founder's pain point: AV diagnostic.txt files are enormous, and the lines you scan for are three specific strings. Add them as keyword highlights to the local watchlist.",
    title: 'diagnostic.txt',
    prompt: '$ loglens --watchlist av.toml < diagnostic.txt',
    lines: [
      { tone: 'plain', text: '[2026-07-22 10:14] scan pass 3/5 ' },
      { tone: 'fatal', text: 'FATAL' },
      { tone: 'plain', text: ' engine module unrecoverable' },
    ],
    tailNote: 'exit 1 → dashboard alert fired',
  },
  {
    id: 'kube',
    label: 'kubectl pod logs',
    description:
      'Tail a crashing pod, pipe through TraceGlass — the OOMKilled stands out without grep gymnastics, and the exit code surfaces the loop.',
    title: 'pod-logs.txt',
    prompt: '$ kubectl logs api-x-7f9c | loglens',
    lines: [
      { tone: 'muted', text: 'I0712 14:01:02  kubelet: ' },
      { tone: 'info', text: 'INFO' },
      { tone: 'plain', text: '  container started' },
    ],
    extra: [
      { tone: 'muted', text: 'E0712 14:01:09  kubelet: ' },
      { tone: 'warn', text: 'OOMKilled' },
      { tone: 'plain', text: '  memory limit 512Mi exceeded' },
    ],
    tailNote: 'counts: critical=1 warnings=2',
  },
  {
    id: 'ci',
    label: 'CI runner logs',
    description:
      'Wire TraceGlass into a step that fails the build when panic/segfault appears in the runner output — no fragile regex, no pasted logs.',
    title: 'ci-run.log',
    prompt: '$ loglens --watchlist ci.toml < runner.log',
    lines: [
      { tone: 'muted', text: 'step:test ' },
      { tone: 'info', text: 'INFO' },
      { tone: 'plain', text: '  142 assertions passed' },
    ],
    extra: [
      { tone: 'muted', text: 'step:cleanup ' },
      { tone: 'fatal', text: 'panic' },
      { tone: 'plain', text: ': runtime error: index out of range' },
    ],
    tailNote: 'exit 1 → CI failed',
  },
];

function renderTone(tone: string, text: string) {
  switch (tone) {
    case 'muted':
      return <span className="text-zinc-500">{text}</span>;
    case 'info':
      return <span className="bg-yellow-500/20 font-semibold text-yellow-300">{text}</span>;
    case 'warn':
      return <span className="bg-orange-500/25 font-semibold text-orange-300">{text}</span>;
    case 'fatal':
      return <span className="bg-red-500/25 font-bold text-red-300">{text}</span>;
    case 'plain-soft':
      return <span className="text-zinc-400">{text}</span>;
    default:
      return <span className="text-zinc-200">{text}</span>;
  }
}

export function UseCases() {
  return (
    <section id="sources" className="section-lg bg-muted/30 dark:bg-muted/10">
      <div className="container-page flex flex-col gap-12">
        <div className="flex max-w-3xl flex-col gap-3">
          <span className="text-eyebrow">Built for</span>
          <h2 className="text-h2 font-display text-balance text-foreground">
            Wherever the log already lives.
          </h2>
          <p className="text-body-lg text-muted-foreground">
            Splunk exports, Docker Compose output, antivirus diagnostic dumps, Kubernetes pod
            streams, CI runner logs. TraceGlass sits at the end of the pipe.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {useCases.map((uc) => (
            <Card
              key={uc.id}
              id={uc.id}
              className="flex flex-col gap-0 overflow-hidden border-border/60 bg-card/80 p-0"
            >
              <CardHeader className="gap-2 border-b border-border/60 p-5">
                <CardTitle className="text-h4 font-display">{uc.label}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {uc.description}
                </CardDescription>
              </CardHeader>
              <div className="p-3">
                <Terminal prompt={uc.prompt} title={uc.title} compact className="text-[11.5px]">
                  <code>
                    <span className="block whitespace-pre">
                      {uc.lines.map((part, i) => (
                        <span key={`${uc.id}-line-${i}`}>{renderTone(part.tone, part.text)}</span>
                      ))}
                    </span>
                    {uc.extra ? (
                      <span className="block whitespace-pre">
                        {uc.extra.map((part, i) => (
                          <span key={`${uc.id}-extra-${i}`}>
                            {renderTone(part.tone, part.text)}
                          </span>
                        ))}
                      </span>
                    ) : null}
                    <span className="block whitespace-pre pt-2 text-zinc-500">{uc.tailNote}</span>
                  </code>
                </Terminal>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
