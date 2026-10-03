// @polsia:user-owned — shared renderer for public pages and owner previews.
'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/custom/brand-mark';
import { InstallGuide } from '@/components/custom/marketing/install-guide';
import { RichTextContent } from '@/components/custom/marketing/rich-text-content';
import { SignaturesPreview } from '@/components/custom/marketing/signatures-preview';
import { WaitlistForm } from '@/components/custom/waitlist-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getRichText, richTextFieldKey } from '@/lib/business/marketing/rich-text';
import {
  type PageAssetReference,
  type PageContent,
  type PageContentSection,
  SECTION_LAYOUT_KINDS,
  type SectionLayoutPreset,
} from '@/lib/contracts/pages';

const layoutClassNames: Record<SectionLayoutPreset, string> = {
  'one-column': 'grid-cols-1',
  'two-columns': 'grid-cols-1 md:grid-cols-2',
  'three-columns': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};
const layoutKindSet = new Set<string>(SECTION_LAYOUT_KINDS);

function sectionColumns(section: PageContentSection, defaultColumns: string) {
  return section.layout && layoutKindSet.has(section.kind)
    ? layoutClassNames[section.layout]
    : defaultColumns;
}

type PageLike = {
  title: string;
  seoDescription: string;
  content: PageContent;
  sourceKey?: string | null;
};

function text(data: Record<string, unknown>, key: string, fallback = ''): string {
  const value = data[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function records(data: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
  );
}

function strings(data: Record<string, unknown>, key: string): string[] {
  const value = data[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function Copy({
  content,
  section,
  path,
  fallback,
  as = 'span',
  className,
}: {
  content: PageContent;
  section: PageContentSection;
  path: readonly (string | number)[];
  fallback: string;
  as?: 'div' | 'span';
  className?: string;
}) {
  return (
    <RichTextContent
      document={getRichText(content, richTextFieldKey(section.id, ['data', ...path]))}
      fallback={fallback}
      as={as}
      className={className}
    />
  );
}

function AssetReferences({ assets }: { assets: PageAssetReference[] }) {
  if (assets.length === 0) return null;
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {assets.map((asset) => (
        <span
          key={asset.id}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground"
        >
          {asset.url ? (
            <Image
              src={asset.url}
              alt={asset.alt ?? asset.id}
              width={28}
              height={28}
              className="size-7 rounded object-cover"
            />
          ) : null}
          <span>{asset.alt ?? asset.ref ?? asset.id}</span>
        </span>
      ))}
    </div>
  );
}

function LinkButton({
  href,
  children,
  variant = 'default',
}: {
  href: string;
  children: ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
}) {
  const link = href.startsWith('/') ? (
    <Link href={href}>{children}</Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
  return (
    <Button asChild variant={variant} size="lg" className="site-design-button">
      {link}
    </Button>
  );
}

function SectionHeading({
  section,
  content,
}: {
  section: PageContentSection;
  content: PageContent;
}) {
  const data = section.data;
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {text(data, 'eyebrow') ? (
        <span className="text-eyebrow text-brand-700 dark:text-brand-300">
          <Copy
            content={content}
            section={section}
            path={['eyebrow']}
            fallback={text(data, 'eyebrow')}
          />
        </span>
      ) : null}
      <h2 className="text-h2 font-display text-balance text-foreground">
        <Copy
          content={content}
          section={section}
          path={['heading']}
          fallback={text(data, 'heading')}
        />
      </h2>
      {text(data, 'body') ? (
        <p className="text-body-lg text-muted-foreground">
          <Copy content={content} section={section} path={['body']} fallback={text(data, 'body')} />
        </p>
      ) : null}
    </div>
  );
}

function HeroSection({ section, content }: { section: PageContentSection; content: PageContent }) {
  const data = section.data;
  const links = records(data, 'links');
  const stats = records(data, 'stats');
  const terminal =
    typeof data.terminal === 'object' && data.terminal !== null
      ? (data.terminal as Record<string, unknown>)
      : null;
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-brand-900/30 via-background to-background py-20 sm:py-28">
      <div className="container-page grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="flex flex-col gap-6">
          {text(data, 'eyebrow') ? (
            <Badge
              variant="outline"
              className="w-fit border-brand-400/60 px-3 py-1 text-eyebrow text-brand-700 dark:border-brand-700 dark:text-brand-300"
            >
              <Copy
                content={content}
                section={section}
                path={['eyebrow']}
                fallback={text(data, 'eyebrow')}
              />
            </Badge>
          ) : null}
          <h1 className="text-display font-display text-balance text-foreground">
            <Copy
              content={content}
              section={section}
              path={['heading']}
              fallback={text(data, 'heading')}
            />
          </h1>
          <p className="max-w-xl text-body-lg text-muted-foreground">
            <Copy
              content={content}
              section={section}
              path={['body']}
              fallback={text(data, 'body')}
            />
          </p>
          {links.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {links.map((link, index) => (
                <LinkButton
                  key={`${text(link, 'label')}-${index}`}
                  href={text(link, 'href', '/')}
                  variant={index === 0 ? 'default' : 'outline'}
                >
                  {text(link, 'label')}
                </LinkButton>
              ))}
            </div>
          ) : null}
          {stats.length > 0 ? (
            <div className="grid max-w-md grid-cols-3 gap-4 border-t border-border/60 pt-5">
              {stats.map((stat) => (
                <div key={text(stat, 'label')}>
                  <div className="text-h4 font-semibold text-foreground">{text(stat, 'value')}</div>
                  <div className="text-caption text-muted-foreground">{text(stat, 'label')}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {terminal ? (
          <Card className="site-design-card overflow-hidden border-brand-400/30 bg-zinc-950 text-zinc-100 shadow-xl shadow-brand-900/20 dark">
            <CardHeader className="border-b border-zinc-800 bg-zinc-900/70">
              <CardTitle className="font-mono text-xs font-medium text-zinc-400">
                {text(terminal, 'title', 'terminal')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <pre className="whitespace-pre-wrap font-mono text-sm leading-7 text-zinc-200">
                {text(terminal, 'prompt')}
                {'\n'}
                {text(terminal, 'lines')}
              </pre>
            </CardContent>
          </Card>
        ) : null}
      </div>
      <div className="container-page">
        <AssetReferences assets={section.assets} />
      </div>
    </section>
  );
}

function FeaturesSection({
  section,
  content,
}: {
  section: PageContentSection;
  content: PageContent;
}) {
  const items = records(section.data, 'items');
  return (
    <section className="section">
      <div className="container-page flex flex-col gap-10">
        <SectionHeading section={section} content={content} />
        <div className={`grid gap-4 ${sectionColumns(section, 'sm:grid-cols-2 lg:grid-cols-3')}`}>
          {items.map((item) => (
            <Card
              key={text(item, 'title')}
              className="site-design-card lift border-border/60 bg-card/70"
            >
              <CardHeader className="gap-3">
                <Badge variant="outline" className="w-fit">
                  {text(item, 'icon', 'feature')}
                </Badge>
                <CardTitle className="text-h4">
                  <Copy
                    content={content}
                    section={section}
                    path={['items', items.indexOf(item), 'title']}
                    fallback={text(item, 'title')}
                  />
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  <Copy
                    content={content}
                    section={section}
                    path={['items', items.indexOf(item), 'body']}
                    fallback={text(item, 'body')}
                  />
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <AssetReferences assets={section.assets} />
      </div>
    </section>
  );
}

function TerminalCardsSection({
  section,
  content,
}: {
  section: PageContentSection;
  content: PageContent;
}) {
  const items = records(section.data, 'items');
  return (
    <section className="section border-y border-border/50 bg-muted/20">
      <div className="container-page flex flex-col gap-10">
        <SectionHeading section={section} content={content} />
        <div className={`grid gap-5 ${sectionColumns(section, 'md:grid-cols-2 lg:grid-cols-3')}`}>
          {items.map((item, index) => (
            <Card
              key={text(item, 'title') || String(index)}
              className="site-design-card overflow-hidden border-border/60"
            >
              <CardHeader>
                <Badge variant="outline" className="w-fit">
                  {text(item, 'number', text(item, 'title'))}
                </Badge>
                <CardTitle className="text-h4 font-display">
                  <Copy
                    content={content}
                    section={section}
                    path={['items', items.indexOf(item), 'title']}
                    fallback={text(item, 'title')}
                  />
                </CardTitle>
                <CardDescription>
                  <Copy
                    content={content}
                    section={section}
                    path={['items', items.indexOf(item), 'body']}
                    fallback={text(item, 'body')}
                  />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-200">
                  {text(item, 'command')}
                  {'\n'}
                  {text(item, 'output')}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrivacySection({
  section,
  content,
}: {
  section: PageContentSection;
  content: PageContent;
}) {
  return (
    <section className="section">
      <div className="container-page">
        <Card className="site-design-card mx-auto max-w-3xl border-brand-400/40 bg-gradient-to-br from-brand-900/35 via-background to-background">
          <CardHeader className="gap-4 p-8">
            <Badge variant="outline" className="w-fit">
              Local-only
            </Badge>
            <CardTitle className="text-h2 font-display">
              <Copy
                content={content}
                section={section}
                path={['heading']}
                fallback={text(section.data, 'heading')}
              />
            </CardTitle>
            <CardDescription className="text-body-lg">
              <Copy
                content={content}
                section={section}
                path={['body']}
                fallback={text(section.data, 'body')}
              />
            </CardDescription>
            <div className={`grid gap-3 ${sectionColumns(section, 'sm:grid-cols-3')}`}>
              {strings(section.data, 'points').map((point) => (
                <div
                  key={point}
                  className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm font-medium"
                >
                  {point}
                </div>
              ))}
            </div>
            <AssetReferences assets={section.assets} />
          </CardHeader>
        </Card>
      </div>
    </section>
  );
}

function FaqSection({ section, content }: { section: PageContentSection; content: PageContent }) {
  return (
    <section className="section">
      <div className="container-page grid gap-10 lg:grid-cols-[0.4fr_0.6fr] lg:gap-16">
        <SectionHeading section={section} content={content} />
        <div>
          {records(section.data, 'items').map((item, index) => (
            <details key={text(item, 'question')} className="border-b border-border/60 py-5">
              <summary className="cursor-pointer font-semibold text-foreground">
                <Copy
                  content={content}
                  section={section}
                  path={['items', index, 'question']}
                  fallback={text(item, 'question')}
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                <Copy
                  content={content}
                  section={section}
                  path={['items', index, 'answer']}
                  fallback={text(item, 'answer')}
                />
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Section({ section, content }: { section: PageContentSection; content: PageContent }) {
  switch (section.kind) {
    case 'hero':
      return <HeroSection section={section} content={content} />;
    case 'features':
      return <FeaturesSection section={section} content={content} />;
    case 'use-cases':
      return <TerminalCardsSection section={section} content={content} />;
    case 'how-it-works':
      return <TerminalCardsSection section={section} content={content} />;
    case 'privacy':
      return <PrivacySection section={section} content={content} />;
    case 'pricing':
    case 'billing-card':
      return null;
    case 'faq':
      return <FaqSection section={section} content={content} />;
    case 'install-guide':
      return (
        <section className="section">
          <div className="container-page">
            <SectionHeading section={section} content={content} />
            <InstallGuide />
          </div>
        </section>
      );
    case 'signature-catalog':
      return (
        <section className="section">
          <div className="container-page">
            <SectionHeading section={section} content={content} />
            <SignaturesPreview />
          </div>
        </section>
      );
    case 'waitlist-form':
      return (
        <section className="section">
          <div className="container-page mx-auto max-w-2xl">
            <SectionHeading section={section} content={content} />
            <div className="site-design-card mt-8 rounded-md border border-brand-400/30 bg-card p-6 shadow-lg shadow-black/20">
              <WaitlistForm />
            </div>
          </div>
        </section>
      );
    case 'release-install':
      return (
        <FeaturesSection
          content={content}
          section={{
            ...section,
            kind: 'features',
            data: { ...section.data, eyebrow: 'Install', items: records(section.data, 'items') },
          }}
        />
      );
    case 'cta':
      return (
        <section className="section">
          <div className="container-page">
            <Card className="site-design-card">
              <CardHeader>
                <Badge variant="outline" className="w-fit">
                  <Copy
                    content={content}
                    section={section}
                    path={['eyebrow']}
                    fallback={text(section.data, 'eyebrow', 'More')}
                  />
                </Badge>
                <CardTitle className="text-h2 font-display">
                  <Copy
                    content={content}
                    section={section}
                    path={['heading']}
                    fallback={text(section.data, 'heading')}
                  />
                </CardTitle>
                <CardDescription className="text-body-lg">
                  <Copy
                    content={content}
                    section={section}
                    path={['body']}
                    fallback={text(section.data, 'body')}
                  />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {records(section.data, 'links').map((link, index) => (
                    <LinkButton
                      key={`${text(link, 'label')}-${index}`}
                      href={text(link, 'href', '/')}
                      variant={index === 0 ? 'default' : 'outline'}
                    >
                      {text(link, 'label')}
                    </LinkButton>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      );
    case 'legacy-body':
      return (
        <section className="section">
          <div className="container-page max-w-3xl">
            <SectionHeading section={section} content={content} />
            <p className="mt-8 text-body-lg leading-8">
              <Copy
                content={content}
                section={section}
                path={['body']}
                fallback={text(section.data, 'body')}
              />
            </p>
          </div>
        </section>
      );
    default:
      return (
        <section className="section">
          <div className="container-page">
            <SectionHeading section={section} content={content} />
            <AssetReferences assets={section.assets} />
          </div>
        </section>
      );
  }
}

export function MarketingPageRenderer({
  page,
  preview = false,
}: {
  page: PageLike;
  preview?: boolean;
}) {
  return (
    <article
      data-template={page.sourceKey ?? undefined}
      data-preview={preview || undefined}
      className="site-design-page dark min-h-full bg-zinc-950 text-zinc-100"
      style={{
        backgroundColor: 'var(--site-background)',
        color: 'var(--site-text)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {page.sourceKey === 'home' ? null : (
        <header
          className="border-b border-zinc-800 bg-zinc-950 py-8 sm:py-12"
          style={{ backgroundColor: 'var(--site-background)', borderColor: 'var(--site-border)' }}
        >
          <div className="container-page max-w-4xl">
            <BrandMark className="mb-8 h-16 w-auto" priority sizes="220px" />
            <p className="text-eyebrow font-mono text-brand-300">
              {preview ? 'owner / preview' : (page.sourceKey ?? 'published')} / editable content
            </p>
            <h1 className="mt-3 font-display text-display text-balance text-foreground">
              {page.title}
            </h1>
            <p className="mt-4 max-w-2xl text-body-lg text-muted-foreground">
              {page.seoDescription}
            </p>
          </div>
        </header>
      )}
      {page.content.sections.map((section) => (
        <Section key={section.id} section={section} content={page.content} />
      ))}
    </article>
  );
}
