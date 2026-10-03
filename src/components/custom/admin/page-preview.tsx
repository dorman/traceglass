// @polsia:user-owned — protected draft/public preview island.
'use client';

import { ArrowLeft, Eye } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OwnerAccessCard } from '@/components/custom/admin/owner-access-card';
import { MarketingPageRenderer } from '@/components/custom/marketing/marketing-page-renderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePageOwner } from '@/hooks/use-page-owner';
import { apiFetch } from '@/lib/api-client';
import { PageDetail, type PageDetail as PageDetailValue } from '@/lib/contracts/pages';

export function PagePreview({ pageId }: { pageId: string }) {
  const { isOwner } = usePageOwner();
  const [page, setPage] = useState<PageDetailValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    void apiFetch(`/api/admin/pages/${pageId}`, { schema: PageDetail })
      .then(setPage)
      .catch(() => setError('This page could not be loaded.'));
  }, [isOwner, pageId]);

  if (!isOwner) return <OwnerAccessCard returnTo={`/admin/pages/preview/${pageId}`} />;
  if (error)
    return (
      <p role="alert" className="text-destructive">
        {error}
      </p>
    );
  if (!page) return <p className="text-muted-foreground">Loading preview…</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-3 -ml-3">
            <Link href={`/admin/pages/${page.id}`}>
              <ArrowLeft className="mr-1.5 size-4" aria-hidden />
              Back to editor
            </Link>
          </Button>
          <p className="text-eyebrow font-mono">owner / preview</p>
          <h1 className="mt-2 font-display text-h1">{page.title}</h1>
        </div>
        <Badge variant={page.status === 'PUBLISHED' && !page.hasDraft ? 'default' : 'secondary'}>
          <Eye className="mr-1.5 size-3.5" aria-hidden />
          {page.status === 'PUBLISHED' && !page.hasDraft ? 'Published' : 'Draft preview'}
        </Badge>
      </div>

      <MarketingPageRenderer page={page} preview />
    </div>
  );
}
