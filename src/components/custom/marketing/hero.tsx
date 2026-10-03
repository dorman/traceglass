// @polsia:user-owned — Hero section for the TraceGlass marketing page.
// Server Component. No data fetching; copy is static.

import { Github } from 'lucide-react';
import Link from 'next/link';
import { Terminal } from '@/components/custom/terminal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { canonicalRepositoryUrl } from '@/lib/repository';

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-20 sm:pb-24 sm:pt-28">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[60vh] bg-gradient-to-b from-brand-100/60 via-background to-background dark:from-brand-900/30"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.04)_1px,transparent_1px)] bg-[size:64px_64px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)]" />
      </div>

      <div className="container-page grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="flex flex-col gap-7">
          <Link href="/release" className="w-fit">
            <Badge
              variant="outline"
              className="gap-1.5 border-brand-400/60 bg-background/60 px-3 py-1 text-eyebrow text-brand-700 hover:border-brand-500/80 hover:bg-brand-50/60 dark:border-brand-700 dark:text-brand-300 dark:hover:bg-brand-900/30"
            >
              <span className="size-1.5 rounded-full bg-brand-500" />
              v1.0 · Rust-native
            </Badge>
          </Link>

          <h1 className="text-display font-display text-balance text-foreground">
            Grammarly,{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent dark:from-brand-400 dark:to-brand-200">
              for logs.
            </span>
          </h1>

          <p className="max-w-xl text-balance text-body-lg text-muted-foreground">
            Add a keyword or regex highlight to your local watchlist. TraceGlass highlights, counts,
            and fails the build on the lines you care about, while curated built-in signatures scan
            separately — no AI or network access required.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-11 px-6 text-sm font-semibold">
              <Link href="/install">Install TraceGlass</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-11 px-5 text-sm font-semibold">
              <Link href="#workflow">How it works</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 px-5 text-sm font-semibold">
              <a
                href={canonicalRepositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center"
              >
                <Github aria-hidden="true" className="size-4" />
                Open on GitHub
              </a>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Link
              href="/release"
              className="font-medium text-brand-600 underline-offset-4 hover:underline dark:text-brand-400"
            >
              Latest release: v1
            </Link>
            <span aria-hidden="true" className="text-muted-foreground/50">
              ·
            </span>
            <Link
              href="/signatures"
              className="font-medium text-brand-600 underline-offset-4 hover:underline dark:text-brand-400"
            >
              Open-source signature library
            </Link>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-4 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:max-w-md">
            <div className="flex flex-col gap-0.5">
              <span className="text-h4 font-semibold text-foreground">100%</span>
              <span className="text-caption">runs locally</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-h4 font-semibold text-foreground">0</span>
              <span className="text-caption">bytes uploaded</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-h4 font-semibold text-foreground">1 line</span>
              <span className="text-caption">to install</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-tr from-brand-500/15 via-transparent to-transparent blur-2xl dark:from-brand-500/20"
          />
          <Terminal
            prompt="$ loglens --watchlist loglens.toml < docker-compose.log"
            title="docker-compose.log"
          >
            <code>
              <span className="block whitespace-pre">
                <span className="text-zinc-500">2026-07-22T10:14:02Z </span>
                <span className="text-zinc-400">api-gateway-1 | </span>
                <span className="bg-yellow-500/20 font-semibold text-yellow-300">INFO</span>
                <span className="text-zinc-200"> Server ready on :8080</span>
              </span>
              <span className="block whitespace-pre">
                <span className="text-zinc-500">2026-07-22T10:14:03Z </span>
                <span className="text-zinc-400">api-gateway-1 | </span>
                <span className="bg-yellow-500/20 font-semibold text-yellow-300">INFO</span>
                <span className="text-zinc-200"> Connected to postgres</span>
              </span>
              <span className="block whitespace-pre">
                <span className="text-zinc-500">2026-07-22T10:14:11Z </span>
                <span className="text-zinc-400">payments-api-x | </span>
                <span className="bg-red-500/25 font-bold text-red-300">FATAL</span>
                <span className="text-zinc-200">
                  {' '}
                  NullPointerException at CheckoutService.charge:142
                </span>
              </span>
              <span className="block whitespace-pre">
                <span className="text-zinc-500">2026-07-22T10:14:12Z </span>
                <span className="text-zinc-400">auth-svc-b | </span>
                <span className="bg-orange-500/25 font-semibold text-orange-300">ERROR</span>
                <span className="text-zinc-200"> upstream timeout, retries=3</span>
              </span>
              <span className="block whitespace-pre">
                <span className="text-zinc-500">2026-07-22T10:14:14Z </span>
                <span className="text-zinc-400">payments-api-x | </span>
                <span className="bg-yellow-500/20 font-semibold text-yellow-300">INFO</span>
                <span className="text-zinc-200"> Starting graceful shutdown</span>
              </span>
              <span className="block whitespace-pre text-zinc-500">
                {'\n'}counts: lines=5 critical=1 info=3
              </span>
              <span className="block whitespace-pre">
                <span className="text-zinc-500">$ </span>
                <span className="text-zinc-400">echo $?</span>
              </span>
              <span className="block whitespace-pre bg-red-500/10 font-bold text-red-400">1</span>
            </code>
          </Terminal>
        </div>
      </div>
    </section>
  );
}
