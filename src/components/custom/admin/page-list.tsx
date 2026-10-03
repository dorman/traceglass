// @polsia:user-owned — client island for the owner-only page collection.
'use client';

import { AlertCircle, Eye, FilePlus2, Pencil, Send, Trash2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { OwnerAccessCard } from '@/components/custom/admin/owner-access-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageOwner } from '@/hooks/use-page-owner';
import { apiFetch } from '@/lib/api-client';
import { PageDetail, PageList, type PageListItem } from '@/lib/contracts/pages';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

export function PageListView() {
  const { isOwner } = usePageOwner();
  const [pages, setPages] = useState<PageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PageListItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch('/api/admin/pages', { schema: PageList });
      setPages(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load pages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOwner) void loadPages();
    else setLoading(false);
  }, [isOwner, loadPages]);

  async function setStatus(page: PageListItem) {
    setBusyId(page.id);
    try {
      await apiFetch(`/api/admin/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: page.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }),
        schema: PageDetail,
      });
      toast.success(page.status === 'PUBLISHED' ? 'Page unpublished' : 'Page published');
      await loadPages();
    } catch {
      toast.error('Could not change the page status');
    } finally {
      setBusyId(null);
    }
  }

  async function deletePage() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await apiFetch(`/api/admin/pages/${deleting.id}`, { method: 'DELETE' });
      setPages((current) => current.filter((page) => page.id !== deleting.id));
      toast.success('Page deleted');
      setDeleting(null);
    } catch {
      toast.error('Could not delete the page');
    } finally {
      setBusyId(null);
    }
  }

  if (!isOwner) {
    return <OwnerAccessCard />;
  }

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-eyebrow font-mono">owner / content</p>
          <h1 className="mt-2 font-display text-h1">Marketing pages</h1>
          <p className="mt-3 max-w-2xl text-body-lg text-muted-foreground">
            Draft, publish, and keep the public TraceGlass story current.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/design">Design site</Link>
          </Button>
          <Button asChild className="shadow-brand">
            <Link href="/admin/pages/new">
              <FilePlus2 className="mr-2 size-4" aria-hidden />
              New page
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 p-6" role="alert">
            <AlertCircle className="mt-0.5 size-5 text-destructive" aria-hidden />
            <div>
              <p className="font-semibold">Could not load pages</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={loadPages}
              >
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : pages.length === 0 ? (
        <Card className="border-dashed bg-card/60">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 rounded-full border border-brand-300/50 bg-brand-100/40 p-3 text-brand-700">
              <FilePlus2 className="size-6" aria-hidden />
            </div>
            <h2 className="font-display text-h3">No managed pages yet</h2>
            <p className="mt-2 max-w-md text-muted-foreground">
              Existing public pages are seeded here automatically, alongside any new drafts you
              create.
            </p>
            <Button asChild className="mt-6">
              <Link href="/admin/pages/new">Create your first page</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-brand-200/60 shadow-md">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="font-mono text-lg">Page index</CardTitle>
            <CardDescription>
              {pages.length} managed page{pages.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {pages.map((page) => (
                <article
                  key={page.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-display text-h4">{page.title}</h2>
                      <Badge variant={page.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                        {page.status === 'PUBLISHED'
                          ? page.hasDraft
                            ? 'Draft changes'
                            : 'Published'
                          : 'Draft'}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate font-mono text-sm text-muted-foreground">
                      /{page.slug}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Updated {formatDate(page.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild type="button" variant="ghost" size="sm">
                      <Link href={`/admin/pages/preview/${page.id}`}>
                        <Eye className="mr-1.5 size-4" aria-hidden />
                        Preview
                      </Link>
                    </Button>
                    {page.status === 'PUBLISHED' && (
                      <Button asChild type="button" variant="ghost" size="sm">
                        <Link
                          href={page.sourcePath ?? `/pages/${page.slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Eye className="mr-1.5 size-4" aria-hidden />
                          Public
                        </Link>
                      </Button>
                    )}
                    <Button asChild type="button" variant="outline" size="sm">
                      <Link href={`/admin/pages/${page.id}`}>
                        <Pencil className="mr-1.5 size-4" aria-hidden />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busyId === page.id}
                      onClick={() => void setStatus(page)}
                    >
                      {page.status === 'PUBLISHED' ? (
                        <Undo2 className="mr-1.5 size-4" aria-hidden />
                      ) : (
                        <Send className="mr-1.5 size-4" aria-hidden />
                      )}
                      {page.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      disabled={busyId === page.id}
                      onClick={() => setDeleting(page)}
                      aria-label={`Delete ${page.title}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this page?</DialogTitle>
            <DialogDescription>
              “{deleting?.title}” and its draft content will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void deletePage()}
              disabled={busyId === deleting?.id}
            >
              Delete page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
