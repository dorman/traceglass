// @polsia:user-owned — client island for the public signature catalog preview.
'use client';

import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { SignatureCatalogResponse } from '@/lib/contracts/signatures';

function CatalogLoading() {
  return (
    <main className="container-page py-16 sm:py-24">
      <output className="block text-body text-muted-foreground">Loading signature library…</output>
    </main>
  );
}

function CatalogError() {
  return (
    <main className="container-page py-16 sm:py-24">
      <p role="alert" className="text-body text-muted-foreground">
        We could not load the signature library.
      </p>
    </main>
  );
}

function CatalogEmpty() {
  return (
    <main className="container-page py-16 sm:py-24">
      <p className="text-body text-muted-foreground">No signature sets are available.</p>
    </main>
  );
}

export function SignaturesPreview() {
  const [catalog, setCatalog] = useState<SignatureCatalogResponse | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;

    apiFetch('/api/signatures', { schema: SignatureCatalogResponse })
      .then((data) => {
        if (active) {
          setCatalog(data);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return <CatalogError />;
  }

  if (!catalog) {
    return <CatalogLoading />;
  }

  if (catalog.sets.length === 0) {
    return <CatalogEmpty />;
  }

  return (
    <main className="flex flex-col">
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute -right-24 -top-32 size-[28rem] rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-700/20" />
          <div className="absolute -bottom-40 left-1/3 size-96 rounded-full bg-brand-100/50 blur-3xl dark:bg-brand-900/20" />
        </div>

        <div className="container-page py-16 sm:py-24">
          <div className="flex max-w-3xl flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-eyebrow text-brand-700 dark:text-brand-300">{catalog.eyebrow}</p>
              <Badge
                variant="outline"
                className="border-brand-400/60 bg-background/60 px-2.5 py-1 font-mono text-xs text-brand-700 dark:border-brand-700 dark:text-brand-300"
              >
                {catalog.version}
              </Badge>
            </div>
            <h1 className="text-display font-display text-balance text-foreground">
              {catalog.heading}
            </h1>
            <p className="max-w-2xl text-body-lg text-muted-foreground">{catalog.intro}</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <div className="grid gap-5 lg:grid-cols-3">
            {catalog.sets.map((signature) => (
              <Card
                key={signature.set}
                className="group flex h-full flex-col border-border/70 bg-gradient-to-br from-background to-muted/20 transition-shadow duration-300 hover:shadow-lg"
              >
                <CardHeader className="gap-4 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <code className="font-mono text-xs text-muted-foreground">{signature.set}</code>
                    <Badge
                      variant="outline"
                      className="border-brand-400/60 bg-brand-50/60 px-2.5 py-1 text-eyebrow text-brand-700 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                    >
                      {signature.severity}
                    </Badge>
                  </div>
                  <CardTitle className="text-h4 font-display leading-snug">
                    {signature.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {signature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-5">
                  <div className="rounded-lg border border-border/60 bg-muted/40 p-4 dark:bg-muted/15">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-eyebrow text-brand-700 dark:text-brand-300">
                        Sample
                      </span>
                      <span className="font-mono text-caption text-muted-foreground">
                        {signature.version}
                      </span>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/85">
                      <code>
                        {signature.sample.map((line) => (
                          <span key={`${signature.set}-${line}`} className="block">
                            {line}
                          </span>
                        ))}
                      </code>
                    </pre>
                  </div>

                  <Button
                    asChild
                    variant="link"
                    size="sm"
                    className="mt-auto w-fit gap-1 px-0 font-medium text-brand-600 dark:text-brand-400"
                  >
                    <a href={signature.manifestHref} target="_blank" rel="noreferrer">
                      View manifest
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
