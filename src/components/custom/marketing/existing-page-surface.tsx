// @polsia:user-owned — published data island for an existing marketing route.
'use client';

import { useEffect, useState } from 'react';
import { MarketingPageRenderer } from '@/components/custom/marketing/marketing-page-renderer';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { PublicPage, type PublicPage as PublicPageValue } from '@/lib/contracts/pages';

export function ExistingPageSurface({ sourceKey }: { sourceKey: string }) {
  const [page, setPage] = useState<PublicPageValue | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let active = true;
    void apiFetch(`/api/pages/${encodeURIComponent(sourceKey)}`, { schema: PublicPage })
      .then((result) => {
        if (!active) return;
        setPage(result);
        setState('ready');
      })
      .catch(() => {
        if (active) setState('missing');
      });
    return () => {
      active = false;
    };
  }, [sourceKey]);

  if (state === 'loading') {
    return (
      <main className="dark container-page section bg-zinc-950 text-zinc-100">
        <p className="text-body text-muted-foreground">Loading page…</p>
      </main>
    );
  }

  if (state === 'missing' || !page) {
    return (
      <main className="dark container-page section bg-zinc-950 text-zinc-100">
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle className="font-display text-h3">Page unavailable</CardTitle>
            <CardDescription>This page is unpublished or does not exist.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return <MarketingPageRenderer page={page} />;
}
