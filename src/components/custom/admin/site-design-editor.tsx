// @polsia:user-owned — owner-only visual settings editor and live public preview.
'use client';

import { ArrowLeft, Check, Save } from 'lucide-react';
import Link from 'next/link';
import { type CSSProperties, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { OwnerAccessCard } from '@/components/custom/admin/owner-access-card';
import { MarketingPageRenderer } from '@/components/custom/marketing/marketing-page-renderer';
import { SiteFooter, SiteNav } from '@/components/custom/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePageOwner } from '@/hooks/use-page-owner';
import { apiFetch } from '@/lib/api-client';
import {
  PageList,
  type PageListItem,
  PublicPage,
  type PublicPage as PublicPageValue,
} from '@/lib/contracts/pages';
import {
  DEFAULT_SITE_DESIGN,
  type SiteDesign,
  SiteDesignResponse,
  SiteDesignSchema,
  siteDesignCssVariables,
} from '@/lib/contracts/site-design';

type PreviewPageOption = { label: string; path: string; lookupKey: string };

const colorFields: { key: keyof SiteDesign['colors']; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'text', label: 'Text' },
  { key: 'mutedText', label: 'Muted text' },
  { key: 'border', label: 'Border' },
];

function pagePath(page: PageListItem) {
  const sourcePath = page.sourcePath;
  const safeSourcePath =
    sourcePath?.startsWith('/') &&
    !sourcePath.startsWith('//') &&
    !sourcePath.startsWith('/admin/') &&
    !sourcePath.startsWith('/api/')
      ? sourcePath
      : null;
  return safeSourcePath ?? `/pages/${page.slug}`;
}

export function SiteDesignEditor() {
  const { isOwner, isLoading: ownerLoading } = usePageOwner();
  const [design, setDesign] = useState<SiteDesign>(DEFAULT_SITE_DESIGN);
  const [pages, setPages] = useState<PreviewPageOption[]>([
    { label: 'Home page', path: '/', lookupKey: 'home' },
  ]);
  const [previewPageKey, setPreviewPageKey] = useState('home');
  const [previewPage, setPreviewPage] = useState<PublicPageValue | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ownerLoading) return;
    if (!isOwner) {
      setLoading(false);
      return;
    }

    let active = true;
    void apiFetch('/api/admin/site-design', { schema: SiteDesignResponse })
      .then((response) => {
        if (!active) return;
        setDesign(response.design);
      })
      .catch(() => {
        if (active) setError('Could not load the current site design.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    void apiFetch('/api/admin/pages', { schema: PageList })
      .then((response) => {
        if (!active) return;
        const published = response.items
          .filter((page) => page.status === 'PUBLISHED')
          .map((page) => ({
            label: page.title,
            path: pagePath(page),
            lookupKey: page.sourceKey ?? page.slug,
          }))
          .filter((page) => page.path !== '/');
        setPages([{ label: 'Home page', path: '/', lookupKey: 'home' }, ...published]);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [isOwner, ownerLoading]);

  const selectedPreviewPage = pages.find((page) => page.lookupKey === previewPageKey) ?? pages[0];
  useEffect(() => {
    if (ownerLoading || !isOwner || !selectedPreviewPage) return;
    let active = true;
    setPreviewLoading(true);
    setPreviewError(false);
    void apiFetch(`/api/pages/${encodeURIComponent(selectedPreviewPage.lookupKey)}`, {
      schema: PublicPage,
    })
      .then((page) => {
        if (active) setPreviewPage(page);
      })
      .catch(() => {
        if (active) {
          setPreviewPage(null);
          setPreviewError(true);
        }
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOwner, ownerLoading, selectedPreviewPage?.lookupKey, selectedPreviewPage]);

  function updateDesign(next: unknown) {
    const parsed = SiteDesignSchema.safeParse(next);
    if (!parsed.success) return;
    setDesign(parsed.data);
    setSaved(false);
    setError(null);
  }

  async function saveDesign() {
    const parsed = SiteDesignSchema.safeParse(design);
    if (!parsed.success) {
      setError('Choose supported colors and appearance options before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch('/api/admin/site-design', {
        method: 'PATCH',
        body: JSON.stringify(parsed.data),
        schema: SiteDesignResponse,
      });
      setDesign(response.design);
      setSaved(true);
      window.dispatchEvent(new CustomEvent('site-design:saved', { detail: response.design }));
      toast.success('Website appearance saved');
    } catch {
      setError('Could not save the site design. Your changes are still here.');
      toast.error('Could not save the site design');
    } finally {
      setSaving(false);
    }
  }

  if (!isOwner) {
    return <OwnerAccessCard returnTo="/admin/design" />;
  }
  if (loading) return <p className="text-muted-foreground">Loading site design…</p>;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-3 -ml-3">
            <Link href="/admin/pages">
              <ArrowLeft className="mr-1.5 size-4" aria-hidden />
              Manage pages
            </Link>
          </Button>
          <p className="text-eyebrow font-mono">owner / design</p>
          <h1 className="mt-2 font-display text-h1">Website appearance</h1>
          <p className="mt-3 max-w-2xl text-body-lg text-muted-foreground">
            Tune the TraceGlass palette and type, then preview a published page before saving.
          </p>
        </div>
        <Button type="button" disabled={saving || saved} onClick={() => void saveDesign()}>
          {saved ? (
            <Check className="mr-2 size-4" aria-hidden />
          ) : (
            <Save className="mr-2 size-4" aria-hidden />
          )}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save appearance'}
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-h3">Colors</CardTitle>
              <CardDescription>
                Use six-digit hex colors. The initial palette keeps the dark terminal surface and
                muted green signal.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {colorFields.map(({ key, label }) => {
                const id = `design-color-${key}`;
                return (
                  <div key={key} className="grid gap-2">
                    <label htmlFor={id} className="text-sm font-medium">
                      {label}
                    </label>
                    <div className="flex min-w-0 items-center gap-2 rounded-md border border-input bg-background p-2">
                      <Input
                        id={id}
                        type="color"
                        className="h-9 w-11 shrink-0 cursor-pointer border-0 p-0"
                        value={design.colors[key]}
                        onChange={(event) =>
                          updateDesign({
                            ...design,
                            colors: { ...design.colors, [key]: event.target.value.toUpperCase() },
                          })
                        }
                      />
                      <span className="truncate font-mono text-xs">{design.colors[key]}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-h3">Typography and components</CardTitle>
              <CardDescription>
                Choose from fixed font and component treatment presets.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium" htmlFor="design-display-font">
                Display font
                <select
                  id="design-display-font"
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={design.typography.displayFont}
                  onChange={(event) =>
                    updateDesign({
                      ...design,
                      typography: { ...design.typography, displayFont: event.target.value },
                    })
                  }
                >
                  <option value="space-mono">Space Mono</option>
                  <option value="ibm-plex-sans">IBM Plex Sans</option>
                  <option value="system">System sans</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium" htmlFor="design-body-font">
                Body font
                <select
                  id="design-body-font"
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={design.typography.bodyFont}
                  onChange={(event) =>
                    updateDesign({
                      ...design,
                      typography: { ...design.typography, bodyFont: event.target.value },
                    })
                  }
                >
                  <option value="ibm-plex-sans">IBM Plex Sans</option>
                  <option value="space-mono">Space Mono</option>
                  <option value="system">System sans</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium" htmlFor="design-radius">
                Corner radius
                <select
                  id="design-radius"
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={design.radius}
                  onChange={(event) => updateDesign({ ...design, radius: event.target.value })}
                >
                  <option value="sharp">Sharp</option>
                  <option value="soft">Soft</option>
                  <option value="rounded">Rounded</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium" htmlFor="design-card-treatment">
                Card treatment
                <select
                  id="design-card-treatment"
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={design.cardTreatment}
                  onChange={(event) =>
                    updateDesign({ ...design, cardTreatment: event.target.value })
                  }
                >
                  <option value="terminal">Terminal depth</option>
                  <option value="outlined">Outlined</option>
                  <option value="soft">Soft surface</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium" htmlFor="design-button-treatment">
                Button treatment
                <select
                  id="design-button-treatment"
                  className="h-10 rounded-md border border-input bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={design.buttonTreatment}
                  onChange={(event) =>
                    updateDesign({ ...design, buttonTreatment: event.target.value })
                  }
                >
                  <option value="terminal">Terminal solid</option>
                  <option value="outlined">Outlined</option>
                  <option value="soft">Soft corners</option>
                </select>
              </label>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="font-display text-h3">Live preview</CardTitle>
                <CardDescription>Unsaved choices are applied to this page only.</CardDescription>
              </div>
              <label className="grid gap-1 text-sm font-medium" htmlFor="design-preview-page">
                Preview page
                <select
                  id="design-preview-page"
                  className="h-10 max-w-full rounded-md border border-input bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={previewPageKey}
                  onChange={(event) => setPreviewPageKey(event.target.value)}
                >
                  {pages.map((page) => (
                    <option key={page.lookupKey} value={page.lookupKey}>
                      {page.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-3 sm:p-5">
            <span className="text-xs text-muted-foreground">
              {saved ? 'Showing saved appearance' : 'Unsaved changes'}
            </span>
            <section
              className="site-design-preview dark max-h-[min(72vh,52rem)] min-h-[30rem] overflow-auto rounded-md border border-border bg-background text-foreground"
              data-site-card-treatment={design.cardTreatment}
              data-site-button-treatment={design.buttonTreatment}
              style={siteDesignCssVariables(design) as CSSProperties}
              aria-label={`Preview of ${selectedPreviewPage?.label ?? 'public page'}`}
            >
              {previewLoading ? (
                <output className="block p-6 text-sm text-muted-foreground" aria-live="polite">
                  Loading public page preview…
                </output>
              ) : previewError || !previewPage ? (
                <p className="p-6 text-sm text-muted-foreground" role="alert">
                  This page could not be loaded for preview.
                </p>
              ) : (
                <>
                  <SiteNav />
                  <MarketingPageRenderer page={previewPage} preview />
                  <SiteFooter />
                </>
              )}
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
