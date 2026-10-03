// @polsia:user-owned — public client island for a published managed page.
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MarketingPageRenderer } from '@/components/custom/marketing/marketing-page-renderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { PublicPage, type PublicPage as PublicPageValue } from '@/lib/contracts/pages';

export function ManagedPage({ slug }: { slug: string }) {
  const [page, setPage] = useState<PublicPageValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void apiFetch(`/api/pages/${encodeURIComponent(slug)}`, { schema: PublicPage })
      .then(setPage)
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main className="container-page section">
        <p className="text-muted-foreground">Loading page…</p>
      </main>
    );
  }

  if (missing || !page) {
    return (
      <main className="container-page section">
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle className="font-display text-h3">Page not found</CardTitle>
            <CardDescription>This page is unpublished or does not exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Return home</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <MarketingPageRenderer page={page} />;
}
