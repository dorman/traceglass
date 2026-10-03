// @polsia:user-owned — client island for the public TraceGlass beta install guide.
'use client';

import { AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck, Terminal } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import {
  InstallGuideResponse,
  type InstallGuideResponse as InstallGuideResponseValue,
} from '@/lib/contracts/install';

function LoadingState() {
  return (
    <section className="section px-0">
      <div className="container-page">
        <div className="flex max-w-3xl flex-col gap-4">
          <span className="text-eyebrow text-brand-700 dark:text-brand-300">Beta installer</span>
          <h1 className="text-display font-display text-balance">
            Loading the signed install path…
          </h1>
          <output aria-live="polite" className="text-body-lg text-muted-foreground">
            Checking which installers have actually been published.
          </output>
        </div>
      </div>
    </section>
  );
}

function ErrorState() {
  return (
    <section className="section px-0">
      <div className="container-page">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <Badge variant="outline" className="w-fit border-destructive/40 text-destructive">
              Catalog unavailable
            </Badge>
            <CardTitle className="text-h2 font-display">No download was enabled.</CardTitle>
            <CardDescription>
              The release catalog could not be verified. Downloads stay disabled until the signed
              catalog is available again.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </section>
  );
}

function PlatformCard({
  platform,
}: {
  platform: InstallGuideResponseValue['releases']['platforms'][number];
}) {
  const downloadUrl = platform.availability === 'available' ? platform.downloadUrl : null;
  const available = downloadUrl !== null;

  return (
    <Card className="flex h-full flex-col border-border/70 bg-card/80 transition-shadow duration-300 hover:shadow-lg">
      <CardHeader className="gap-3 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-h4 font-display leading-snug">{platform.name}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{platform.note}</p>
          </div>
          {available ? (
            <CheckCircle2 aria-hidden="true" className="mt-1 size-5 shrink-0 text-brand-600" />
          ) : (
            <AlertTriangle
              aria-hidden="true"
              className="mt-1 size-5 shrink-0 text-muted-foreground"
            />
          )}
        </div>
        <code className="w-fit rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-foreground">
          {platform.target}
        </code>
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-4">
        {available ? (
          <Button asChild className="w-fit gap-2">
            <a href={downloadUrl} download>
              Download {platform.installerName}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </Button>
        ) : (
          <Button type="button" disabled variant="secondary" className="w-fit">
            Installer not published
          </Button>
        )}
        <div className="grid gap-3 border-t border-border/60 pt-4 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Permissions:</span>{' '}
            {platform.permissionNote}
          </p>
          <p>
            <span className="font-semibold text-foreground">After install:</span>{' '}
            {platform.launchNote}
          </p>
        </div>
        {available ? (
          <p className="font-mono text-xs text-muted-foreground">
            SHA-256: {platform.sha256?.slice(0, 16)}… · Ed25519 signature required
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FallbackCard({ catalog }: { catalog: InstallGuideResponseValue }) {
  const fallback = catalog.releases.fallback;
  return (
    <Card className="border-brand-200/70 bg-gradient-to-br from-brand-50/70 via-background to-background shadow-md dark:border-brand-800/40 dark:from-brand-900/15">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="flex gap-4">
          <Terminal aria-hidden="true" className="mt-1 size-6 shrink-0 text-brand-600" />
          <div className="flex flex-col gap-2">
            <CardTitle className="text-h3 font-display">{fallback.label}</CardTitle>
            <CardDescription>{fallback.details}</CardDescription>
          </div>
        </div>
        <Button asChild variant="outline" className="w-fit shrink-0 gap-2">
          <Link href={fallback.docsUrl} target="_blank">
            Read the CLI guide
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/50 px-4 py-4 font-mono text-sm text-foreground">
          <code>$ {fallback.command}</code>
        </pre>
      </CardContent>
    </Card>
  );
}

function ReadyState({ catalog }: { catalog: InstallGuideResponseValue }) {
  const release = catalog.releases;
  const published = release.releaseStatus === 'published';
  return (
    <main className="flex flex-col">
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute -right-24 -top-32 size-[28rem] rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-700/20" />
          <div className="absolute -bottom-40 left-1/3 size-96 rounded-full bg-brand-100/50 blur-3xl dark:bg-brand-900/20" />
        </div>
        <div className="container-page grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="flex max-w-2xl flex-col gap-6">
            <Badge
              variant="outline"
              className="w-fit gap-2 border-brand-400/60 px-3 py-1 text-eyebrow text-brand-700 dark:border-brand-700 dark:text-brand-300"
            >
              <span className="size-1.5 rounded-full bg-brand-500" />
              TraceGlass one-click beta installer
            </Badge>
            <h1 className="text-display font-display text-balance text-foreground">
              Install TraceGlass. Land in the TUI.
            </h1>
            <p className="max-w-xl text-body-lg text-muted-foreground">
              Choose the installer for your machine. It verifies the signed release before writing
              anything, installs for your current user, and asks before PATH changes or launching a
              new terminal.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2 px-6">
                <a href={release.releasePageUrl} target="_blank" rel="noreferrer">
                  {published ? 'Choose an installer' : 'See release status'}
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/release">Read the release plan</Link>
              </Button>
            </div>
          </div>
          <Card className="border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl shadow-brand-900/15 dark">
            <CardHeader className="border-b border-zinc-800 bg-zinc-900/70">
              <CardTitle className="font-mono text-xs font-medium text-zinc-400">
                verification before installation
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5">
              <div className="flex gap-3">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-300" />
                <p className="text-sm leading-relaxed text-zinc-300">
                  Ed25519 manifest and payload signatures plus SHA-256 hashes are checked locally.
                  Missing or mismatched data stops before extraction or installation.
                </p>
              </div>
              <div className="border-t border-zinc-800 pt-4 font-mono text-xs leading-6 text-zinc-400">
                <p>install scope: current user</p>
                <p>launch: explicit consent</p>
                <p>telemetry: none · service: none</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="container-page flex flex-col gap-10">
          <div className="flex max-w-3xl flex-col gap-4">
            <span className="text-eyebrow text-brand-700 dark:text-brand-300">
              Platform chooser
            </span>
            <h2 className="text-h2 font-display text-balance">Pick the exact supported target.</h2>
            <p className="text-body-lg text-muted-foreground">{release.description}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {release.platforms.map((platform) => (
              <PlatformCard key={platform.target} platform={platform} />
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-muted/20">
        <div className="container-page grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-h3 font-display">What the beta installer does</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                It never runs downloaded text, accepts server commands, uploads logs, enables
                telemetry, installs a service, or silently updates itself.
              </p>
              <p>
                It asks before adding PATH entries, creating a shortcut, or opening a terminal.
                Administrator prompts are only for a user-selected system-wide location; the default
                is current-user.
              </p>
              <p>
                After consent, a new terminal starts the same no-argument TraceGlass interactive
                welcome/browser TUI. File, stdin, piped, JSON, and CSV modes remain available from
                that terminal.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-h3 font-display">Trust and OS prompts</CardTitle>
              <CardDescription>{release.verification.osSigningLimitations}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Release signatures are checked before any install write. Invalid, missing, altered,
                or unexpected files fail closed.
              </p>
              <p>
                Unsigned platform publisher status may still cause Gatekeeper, SmartScreen, or Linux
                desktop warnings. Those warnings are not replaced with a claim of OS signing.
              </p>
              <p className="font-mono text-xs text-foreground">
                Signing format: {release.verification.signatureScheme}
              </p>
            </CardContent>
          </Card>
          <div className="lg:col-span-2">
            <FallbackCard catalog={catalog} />
          </div>
        </div>
      </section>
    </main>
  );
}

export function InstallGuide() {
  const [catalog, setCatalog] = useState<InstallGuideResponseValue | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    void apiFetch('/api/install', { schema: InstallGuideResponse })
      .then((result) => {
        if (active) setCatalog(result);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadError) return <ErrorState />;
  if (!catalog) return <LoadingState />;
  return <ReadyState catalog={catalog} />;
}
