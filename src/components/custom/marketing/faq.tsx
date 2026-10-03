// @polsia:user-owned — FAQ section for the TraceGlass marketing page.
// Server Component. 5 honest items using the Accordion primitive. The shipped
// Accordion root is a Radix client component — keeping this section a Server
// Component here just means the page tree stays a Server Component while the
// internals of <Accordion/> hydrate on their own (the existing shadcn pattern).

import Link from 'next/link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const items = [
  {
    q: 'How does this differ from grep --color?',
    a: 'grep highlights a pattern. TraceGlass keeps curated built-in signatures as separate scan evidence, while your keyword and regex highlights are user-controlled entries in a local watchlist. It prints counts and exits non-zero on critical findings, so one command replaces a grep wrapper script in CI.',
  },
  {
    q: 'Does it upload my logs?',
    a: 'No. The CLI is a single Rust binary that reads from stdin, a file, or a pipe and writes to your terminal. The local watchlist needs no AI or network access: there is no network call, hosted backend, or analytics. The same binary that runs in your terminal this morning will run the same way next year.',
  },
  {
    q: "What's the install method?",
    a: (
      <>
        The TraceGlass one-click beta installer is planned for Linux glibc x86_64, macOS Apple
        silicon, macOS Intel, and Windows x86_64. It will verify the signed release before
        installing for the current user; downloads remain disabled until those artifacts exist.{' '}
        <Link
          href="/install"
          className="font-medium text-brand-700 underline-offset-4 hover:underline dark:text-brand-300"
        >
          See the full install guide.
        </Link>{' '}
        Technical users can build from source while the signed beta release is unpublished. The
        single-binary distribution is what keeps the tool auditable in five minutes.
      </>
    ),
  },
  {
    q: 'What about regex highlights and watchlists?',
    a: 'The TUI supports keyword and regex highlights today. Press a or r to add the selected highlight to your local watchlist. Curated built-in signatures are a separate versioned scan catalog and never enter the saved list. No candidate suggestions are currently generated.',
  },
  {
    q: 'Which log formats work?',
    a: 'Anything that is line-oriented text. Splunk CSV exports, JSON-per-line, Docker Compose output, kubectl logs piped in plain format, antivirus diagnostic.txt, CI runner output, systemd journalctl in short format. The runner reads each line as a string; local watchlist entries match according to their keyword or regex kind.',
  },
];

export function FAQ() {
  return (
    <section id="faq" className="section">
      <div className="container-page grid gap-10 lg:grid-cols-[0.4fr_0.6fr] lg:gap-16">
        <div className="flex flex-col gap-3">
          <span className="text-eyebrow">FAQ</span>
          <h2 className="text-h2 font-display text-balance text-foreground">
            Questions a developer asks before installing a CLI.
          </h2>
          <p className="text-body-lg text-muted-foreground">
            If yours isn&apos;t here,{' '}
            <a
              href="mailto:traceglass@polsia.app"
              className="font-medium text-brand-700 underline-offset-4 hover:underline dark:text-brand-300"
            >
              write to us
            </a>
            .
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {items.map((item) => (
            <AccordionItem
              key={item.q}
              value={item.q}
              className="border-b border-border/60 last:border-b-0"
            >
              <AccordionTrigger className="py-5 text-base font-semibold text-foreground hover:no-underline hover:text-brand-700 dark:hover:text-brand-300">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
