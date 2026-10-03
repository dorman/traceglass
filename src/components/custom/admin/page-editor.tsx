// @polsia:user-owned — section-aware client editor for managed pages.
'use client';

import { ArrowDown, ArrowLeft, ArrowUp, Eye, Plus, Save, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { OwnerAccessCard } from '@/components/custom/admin/owner-access-card';
import { RichTextEditor } from '@/components/custom/admin/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePageOwner } from '@/hooks/use-page-owner';
import { apiFetch } from '@/lib/api-client';
import {
  getRichText,
  pageBodyRichTextKey,
  richTextFieldKey,
  updatePath,
  withRichText,
} from '@/lib/business/marketing/rich-text';
import {
  PageContent,
  type PageContentSection,
  PageCreate,
  type PageCreate as PageCreateValues,
  PageDetail,
  type PageDetail as PageDetailValue,
  type RichTextDocument,
  SECTION_LAYOUT_KINDS,
  SectionLayoutPreset,
} from '@/lib/contracts/pages';
import {
  getDefaultMarketingPageContent,
  normalizeMarketingPageContent,
} from '@/lib/marketing-page-content';

type PageEditorProps = { pageId?: string };
type EditorValues = PageCreateValues & { content: PageContent };
type FieldErrors = Record<string, string>;
const layoutSectionKinds = new Set<string>(SECTION_LAYOUT_KINDS);
const sectionKinds = [
  'hero',
  'features',
  'use-cases',
  'how-it-works',
  'privacy',
  'faq',
  'install-guide',
  'signature-catalog',
  'waitlist-form',
  'release-install',
  'cta',
  'legacy-body',
] as const;
type EditableSectionKind = (typeof sectionKinds)[number];

function initialValues(): EditorValues {
  return {
    title: '',
    slug: '',
    body: '',
    seoDescription: '',
    content: normalizeMarketingPageContent({ title: '', body: '' }),
  };
}

function fromDetail(page: PageDetailValue): EditorValues {
  return {
    title: page.title,
    slug: page.slug,
    body: page.body,
    seoDescription: page.seoDescription,
    content: page.content,
  };
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

type CopyField = {
  label: string;
  path: (string | number)[];
  value: string;
  allowHeadings: boolean;
};

function records(data: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = data[key];
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
      )
    : [];
}

function copyFields(section: PageContentSection): CopyField[] {
  const fields: CopyField[] = [];
  const add = (label: string, path: (string | number)[], allowHeadings = false) => {
    const value = section.data[path[path.length - 1] ?? ''];
    if (typeof value === 'string') fields.push({ label, path, value, allowHeadings });
  };

  add('Eyebrow', ['eyebrow']);
  add('Heading', ['heading']);
  add('Body', ['body'], true);

  const itemFields: [string, string, boolean][] =
    section.kind === 'faq'
      ? [
          ['Question', 'question', false],
          ['Answer', 'answer', true],
        ]
      : [
          ['Item title', 'title', false],
          ['Item body', 'body', true],
        ];
  if (['features', 'use-cases', 'how-it-works', 'release-install', 'faq'].includes(section.kind)) {
    records(section.data, 'items').forEach((item, index) => {
      for (const [label, key, allowHeadings] of itemFields) {
        if (typeof item[key] === 'string') {
          fields.push({
            label: `${label} ${index + 1}`,
            path: ['items', index, key],
            value: item[key] as string,
            allowHeadings,
          });
        }
      }
    });
  }
  return fields;
}

function causeErrors(error: unknown): FieldErrors {
  const cause = error instanceof Error ? error.cause : undefined;
  const body = objectValue(cause);
  const errors = body ? objectValue(body.errors) : null;
  if (!errors) return {};
  return Object.fromEntries(
    Object.entries(errors).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

export function PageEditor({ pageId }: PageEditorProps) {
  const router = useRouter();
  const { isOwner, isLoading: ownerLoading } = usePageOwner();
  const [values, setValues] = useState<EditorValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(Boolean(pageId));
  const [busy, setBusy] = useState(false);
  const [newSectionKind, setNewSectionKind] = useState<EditableSectionKind>('features');

  useEffect(() => {
    if (!pageId) {
      setLoading(false);
      return;
    }
    if (ownerLoading) return;
    if (!isOwner) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void apiFetch(`/api/admin/pages/${pageId}`, { schema: PageDetail })
      .then((page) => {
        if (active) setValues(fromDetail(page));
      })
      .catch(() => {
        if (active) toast.error('Could not load this page');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOwner, ownerLoading, pageId]);

  function setField(field: keyof EditorValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  function updatePageBody(document: RichTextDocument, plainText: string) {
    setValues((current) => ({
      ...current,
      body: plainText,
      content: withRichText(current.content, pageBodyRichTextKey, document),
    }));
    setErrors((current) => ({ ...current, body: '' }));
  }

  function updateCopyField(
    section: PageContentSection,
    field: CopyField,
    document: RichTextDocument,
    plainText: string,
  ) {
    const key = richTextFieldKey(section.id, ['data', ...field.path]);
    setValues((current) => {
      const sections = current.content.sections.map((item) =>
        item.id === section.id
          ? { ...item, data: updatePath(item.data, field.path, plainText) }
          : item,
      );
      return {
        ...current,
        content: withRichText({ ...current.content, sections }, key, document),
      };
    });
  }

  function updateSection(id: string, value: string, field: 'data' | 'assets') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (field === 'data' && objectValue(parsed)) {
        const nextContent = PageContent.safeParse({
          ...values.content,
          sections: values.content.sections.map((item) =>
            item.id === id ? { ...item, data: parsed } : item,
          ),
        });
        if (!nextContent.success) throw new Error('Invalid section data');
        setValues((current) => ({ ...current, content: nextContent.data }));
      } else if (field === 'assets' && Array.isArray(parsed)) {
        const nextContent = PageContent.safeParse({
          ...values.content,
          sections: values.content.sections.map((item) =>
            item.id === id ? { ...item, assets: parsed } : item,
          ),
        });
        if (!nextContent.success) throw new Error('Invalid section assets');
        setValues((current) => ({ ...current, content: nextContent.data }));
      } else {
        throw new Error('Invalid section JSON');
      }
      setErrors((current) => ({ ...current, [`section.${id}.${field}`]: '' }));
    } catch {
      setErrors((current) => ({ ...current, [`section.${id}.${field}`]: 'Enter valid JSON.' }));
    }
  }

  function updatePageAssets(value: string) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) throw new Error('Invalid page assets');
      const nextContent = PageContent.safeParse({ ...values.content, assets: parsed });
      if (!nextContent.success) throw new Error('Invalid page assets');
      setValues((current) => ({ ...current, content: nextContent.data }));
      setErrors((current) => ({ ...current, 'content.assets': '' }));
    } catch {
      setErrors((current) => ({ ...current, 'content.assets': 'Enter valid JSON.' }));
    }
  }

  function moveSection(id: string, direction: -1 | 1) {
    setValues((current) => {
      const index = current.content.sections.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.content.sections.length)
        return current;
      const sections = [...current.content.sections];
      const currentSection = sections[index];
      const nextSection = sections[nextIndex];
      if (!currentSection || !nextSection) return current;
      sections[index] = nextSection;
      sections[nextIndex] = currentSection;
      return { ...current, content: { ...current.content, sections } };
    });
  }

  function addSection() {
    const templates = ['home', 'install', 'release', 'signatures', 'waitlist', 'billing'].flatMap(
      (templateKey) => getDefaultMarketingPageContent(templateKey).sections,
    );
    const template = templates.find((section) => section.kind === newSectionKind);
    const section = template
      ? { ...template, id: `${newSectionKind}-${crypto.randomUUID()}` }
      : newSectionKind === 'legacy-body'
        ? {
            id: `legacy-body-${crypto.randomUUID()}`,
            kind: 'legacy-body',
            data: { heading: 'New section', body: 'Add section copy in the editor.' },
            assets: [],
          }
        : null;
    if (!section) return;
    const parsed = PageContent.safeParse({
      ...values.content,
      sections: [...values.content.sections, section],
    });
    if (!parsed.success) {
      toast.error('Could not add that section');
      return;
    }
    setValues((current) => ({ ...current, content: parsed.data }));
  }

  function removeSection(id: string) {
    setValues((current) => ({
      ...current,
      content: {
        ...current.content,
        sections: current.content.sections.filter((section) => section.id !== id),
      },
    }));
  }

  function updateSectionLayout(id: string, value: string) {
    const parsedLayout = value ? SectionLayoutPreset.safeParse(value) : null;
    if (value && !parsedLayout?.success) return;
    setValues((current) => ({
      ...current,
      content: {
        ...current.content,
        sections: current.content.sections.map((section) =>
          section.id === id
            ? { ...section, layout: parsedLayout?.success ? parsedLayout.data : undefined }
            : section,
        ),
      },
    }));
  }

  async function save(publish: boolean) {
    setBusy(true);
    setErrors({});
    const parsed = PageCreate.safeParse(values);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
        const message = messages[0];
        if (message) next[field] = message;
      }
      setErrors(next);
      setBusy(false);
      return;
    }
    try {
      const saved = pageId
        ? await apiFetch(`/api/admin/pages/${pageId}`, {
            method: 'PATCH',
            body: JSON.stringify({ ...parsed.data, ...(publish ? { status: 'PUBLISHED' } : {}) }),
            schema: PageDetail,
          })
        : await apiFetch('/api/admin/pages', {
            method: 'POST',
            body: JSON.stringify(parsed.data),
            schema: PageDetail,
          });
      if (publish && !pageId) {
        await apiFetch(`/api/admin/pages/${saved.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'PUBLISHED', content: saved.content }),
          schema: PageDetail,
        });
      }
      setValues(fromDetail(saved));
      toast.success(publish ? 'Page published' : 'Draft saved');
      if (!pageId) router.replace(`/admin/pages/${saved.id}`);
    } catch (error) {
      const next = causeErrors(error);
      setErrors(next);
      if (Object.keys(next).length === 0)
        toast.error(publish ? 'Could not publish the page' : 'Could not save the draft');
    } finally {
      setBusy(false);
    }
  }

  if (!isOwner)
    return <OwnerAccessCard returnTo={pageId ? `/admin/pages/${pageId}` : '/admin/pages'} />;
  if (loading) return <p className="text-muted-foreground">Loading page…</p>;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-3 -ml-3">
            <Link href="/admin/pages">
              <ArrowLeft className="mr-1.5 size-4" aria-hidden />
              All pages
            </Link>
          </Button>
          <p className="text-eyebrow font-mono">owner / editor</p>
          <h1 className="mt-2 font-display text-h1">{pageId ? 'Edit page' : 'New page'}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {pageId ? (
            <Button asChild type="button" variant="outline">
              <Link href={`/admin/pages/preview/${pageId}`}>
                <Eye className="mr-1.5 size-4" aria-hidden />
                Preview
              </Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void save(false)}
          >
            <Save className="mr-1.5 size-4" aria-hidden />
            Save draft
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save(true)}>
            <Send className="mr-1.5 size-4" aria-hidden />
            Publish
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <section className="grid gap-5 rounded-xl border border-brand-200/60 bg-card p-6 shadow-md sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <label htmlFor="page-title" className="font-medium">
              Title
            </label>
            <Input
              id="page-title"
              value={values.title}
              onChange={(event) => setField('title', event.target.value)}
            />
            {errors.title ? <span className="text-sm text-destructive">{errors.title}</span> : null}
          </div>
          <div className="grid gap-2">
            <label htmlFor="page-slug" className="font-medium">
              Slug
            </label>
            <Input
              id="page-slug"
              className="font-mono"
              value={values.slug}
              onChange={(event) => setField('slug', event.target.value)}
            />
            {errors.slug ? <span className="text-sm text-destructive">{errors.slug}</span> : null}
          </div>
          <div className="grid gap-2">
            <label htmlFor="page-seo" className="font-medium">
              SEO description
            </label>
            <Textarea
              id="page-seo"
              value={values.seoDescription}
              onChange={(event) => setField('seoDescription', event.target.value)}
            />
            {errors.seoDescription ? (
              <span className="text-sm text-destructive">{errors.seoDescription}</span>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <RichTextEditor
              fieldKey={pageBodyRichTextKey}
              label="Legacy body fallback"
              fallback={values.body}
              document={getRichText(values.content, pageBodyRichTextKey)}
              onChange={updatePageBody}
            />
            {errors.body ? <span className="text-sm text-destructive">{errors.body}</span> : null}
          </div>
        </section>

        <section className="grid gap-5">
          <div>
            <p className="text-eyebrow">Page definition</p>
            <h2 className="text-h2 font-display">Sections and visual assets</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every section is preserved, including fields this editor does not interpret. Edit
              common copy directly; links, URLs, assets, commands, prices, and unknown keys stay in
              the advanced panel. The order controls change the public page order.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-2 text-sm font-medium" htmlFor="new-section-kind">
              Add a rendered section
              <select
                id="new-section-kind"
                className="h-10 rounded-md border border-input bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={newSectionKind}
                onChange={(event) => setNewSectionKind(event.target.value as EditableSectionKind)}
              >
                {sectionKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="outline" onClick={addSection}>
              <Plus className="mr-1.5 size-4" aria-hidden />
              Add section
            </Button>
          </div>
          <details className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <summary className="cursor-pointer font-medium">Page-level structured values</summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Root asset references and metadata stay untouched unless you explicitly edit them.
            </p>
            <div className="mt-4 grid gap-2">
              <label htmlFor="page-assets" className="font-medium">
                Page-level visual assets
              </label>
              <Textarea
                id="page-assets"
                className="min-h-32 font-mono text-xs"
                value={JSON.stringify(values.content.assets, null, 2)}
                onChange={(event) => updatePageAssets(event.target.value)}
              />
              {errors['content.assets'] ? (
                <span className="text-sm text-destructive">{errors['content.assets']}</span>
              ) : null}
            </div>
          </details>
          {values.content.sections.map((item, index) => (
            <article
              key={item.id}
              className="rounded-xl border border-border/70 bg-card p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {index + 1} / {item.kind}
                  </p>
                  <h3 className="mt-1 text-h3 font-display">{item.id}</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() => moveSection(item.id, -1)}
                    aria-label="Move section up"
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === values.content.sections.length - 1}
                    onClick={() => moveSection(item.id, 1)}
                    aria-label="Move section down"
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSection(item.id)}
                    aria-label={`Remove ${item.kind} section`}
                  >
                    <Trash2 className="mr-1 size-4" aria-hidden />
                    Remove
                  </Button>
                </div>
              </div>
              <div className="mt-5 grid gap-5">
                {layoutSectionKinds.has(item.kind) ? (
                  <label
                    className="grid max-w-sm gap-2 text-sm font-medium"
                    htmlFor={`section-layout-${item.id}`}
                  >
                    Column layout
                    <select
                      id={`section-layout-${item.id}`}
                      className="h-10 rounded-md border border-input bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={item.layout ?? ''}
                      onChange={(event) => updateSectionLayout(item.id, event.target.value)}
                    >
                      <option value="">Renderer default</option>
                      <option value="one-column">One column</option>
                      <option value="two-columns">Two columns</option>
                      <option value="three-columns">Three columns</option>
                    </select>
                    <span className="font-normal text-muted-foreground">
                      Multi-column layouts stack on narrow screens.
                    </span>
                  </label>
                ) : null}
                {copyFields(item).map((field) => {
                  const key = richTextFieldKey(item.id, ['data', ...field.path]);
                  return (
                    <RichTextEditor
                      key={key}
                      fieldKey={key}
                      label={field.label}
                      fallback={field.value}
                      document={getRichText(values.content, key)}
                      options={{ allowHeadings: field.allowHeadings }}
                      onChange={(document, plainText) =>
                        updateCopyField(item, field, document, plainText)
                      }
                    />
                  );
                })}
                <details className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <summary className="cursor-pointer font-medium">
                    Advanced structured values
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Links, URLs, stats, prices, commands, outputs, feature arrays, asset metadata,
                    and unknown keys are preserved here. Only edit these JSON values when you need
                    to change the structured page definition.
                  </p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="grid gap-2">
                      <label htmlFor={`section-data-${item.id}`} className="font-medium">
                        Structured section data
                      </label>
                      <Textarea
                        id={`section-data-${item.id}`}
                        className="min-h-56 font-mono text-xs"
                        value={JSON.stringify(item.data, null, 2)}
                        onChange={(event) => updateSection(item.id, event.target.value, 'data')}
                      />
                      {errors[`section.${item.id}.data`] ? (
                        <span className="text-sm text-destructive">
                          {errors[`section.${item.id}.data`]}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor={`section-assets-${item.id}`} className="font-medium">
                        Visual asset metadata
                      </label>
                      <Textarea
                        id={`section-assets-${item.id}`}
                        className="min-h-56 font-mono text-xs"
                        value={JSON.stringify(item.assets, null, 2)}
                        onChange={(event) => updateSection(item.id, event.target.value, 'assets')}
                      />
                      {errors[`section.${item.id}.assets`] ? (
                        <span className="text-sm text-destructive">
                          {errors[`section.${item.id}.assets`]}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </details>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
