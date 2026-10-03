import { describe, expect, it } from 'vitest';
import {
  PageContent,
  PageCreate,
  PageDetail,
  PageList,
  PageUpdate,
  PublicPage,
  SECTION_LAYOUT_KINDS,
  SectionLayoutPreset,
} from '@/lib/contracts/pages';
import {
  getDefaultMarketingPageContent,
  normalizeMarketingPageContent,
} from '@/lib/marketing-page-content';
import { richTextFieldKey, withRichText } from '@/lib/business/marketing/rich-text';

const validCreate = {
  title: 'Incident response',
  slug: 'incident-response',
  body: 'A focused page for operators.',
  seoDescription: 'Learn how TraceGlass helps operators find important log events.',
  content: getDefaultMarketingPageContent('home'),
};

const validDates = {
  publishedAt: '2026-09-11T00:00:00.000Z',
  updatedAt: '2026-09-11T00:00:00.000Z',
  createdAt: '2026-09-10T00:00:00.000Z',
};

describe('marketing page contracts', () => {
  it('accepts valid create, update, list, detail, and public payloads', () => {
    expect(PageCreate.parse(validCreate)).toEqual(validCreate);
    expect(PageUpdate.parse({ ...validCreate, status: 'PUBLISHED' })).toMatchObject({
      status: 'PUBLISHED',
    });

    const listItem = {
      id: 'page_1',
      title: validCreate.title,
      slug: validCreate.slug,
      status: 'PUBLISHED',
      publishedAt: validDates.publishedAt,
      updatedAt: validDates.updatedAt,
      sourceKey: null,
      sourcePath: null,
      templateKey: null,
      hasDraft: false,
    } as const;

    expect(PageList.parse({ items: [listItem] })).toEqual({ items: [listItem] });
    expect(PageDetail.parse({ ...listItem, ...validCreate, ...validDates })).toMatchObject(
      validCreate,
    );
    expect(
      PublicPage.parse({
        id: 'page_1',
        ...validCreate,
        publishedAt: validDates.publishedAt,
        sourceKey: null,
        sourcePath: null,
        templateKey: null,
      }),
    ).toMatchObject(validCreate);
  });

  it('rejects empty and overlong fields', () => {
    expect(PageCreate.safeParse({ ...validCreate, title: '' }).success).toBe(false);
    expect(PageCreate.safeParse({ ...validCreate, slug: 'Not A Slug' }).success).toBe(false);
    expect(PageCreate.safeParse({ ...validCreate, body: 'x'.repeat(50_001) }).success).toBe(false);
    expect(PageCreate.safeParse({ ...validCreate, seoDescription: 'x'.repeat(161) }).success).toBe(
      false,
    );
    expect(PageUpdate.safeParse({}).success).toBe(false);
  });

  it('preserves section order, asset metadata, and unknown supported fields', () => {
    const snapshot = {
      version: 1 as const,
      sections: [
        {
          id: 'hero',
          kind: 'hero',
          data: { heading: 'Keep this', customCopy: 'Do not strip me' },
          assets: [
            {
              id: 'hero-image',
              kind: 'image',
              url: 'https://cdn.example.test/hero.png',
              focalPoint: 'center',
            },
          ],
          editorHint: 'hero-section',
        },
      ],
      assets: [
        {
          id: 'hero-image',
          kind: 'image',
          url: 'https://cdn.example.test/hero.png',
          license: 'owned',
        },
      ],
      revision: 'customer-revision',
    };
    expect(PageContent.parse(snapshot)).toEqual(snapshot);
  });

  it('round-trips supported responsive column layouts without changing content', () => {
    const snapshot = {
      version: 1 as const,
      sections: [
        {
          id: 'features-first',
          kind: 'features',
          layout: 'three-columns' as const,
          data: { heading: 'Keep this copy', customValue: { source: 'owner' } },
          assets: [{ id: 'feature-image', kind: 'image', ref: 'saved-asset', alt: 'Evidence' }],
          editorHint: 'preserve this',
        },
        {
          id: 'workflow-second',
          kind: 'how-it-works',
          layout: 'one-column' as const,
          data: { items: [{ title: 'Keep this item' }] },
          assets: [],
        },
      ],
      assets: [],
      richText: {
        'features-first:data.heading': {
          version: 1 as const,
          blocks: [
            {
              id: 'heading:block:0',
              type: 'paragraph' as const,
              children: [{ id: 'heading:text:0', type: 'text' as const, text: 'Rich copy', marks: ['bold' as const] }],
            },
          ],
        },
      },
      revision: 'retained',
    };

    expect(SECTION_LAYOUT_KINDS).toContain('features');
    expect(SectionLayoutPreset.options).toEqual(['one-column', 'two-columns', 'three-columns']);
    expect(PageContent.parse(snapshot)).toEqual(snapshot);
    expect(PageContent.safeParse({
      ...snapshot,
      sections: [{ ...snapshot.sections[0], layout: 'four-columns' }],
    }).success).toBe(false);
    expect(PageContent.safeParse({
      ...snapshot,
      sections: [{ ...snapshot.sections[0], kind: 'hero', layout: 'two-columns' }],
    }).success).toBe(false);
  });

  it('round-trips rich text without changing structured section values', () => {
    const source = {
      version: 1 as const,
      sections: [
        {
          id: 'hero',
          kind: 'hero',
          data: {
            heading: 'Keep this heading',
            links: [{ label: 'Release', href: '/release', tracking: { campaign: 'owner' } }],
            terminal: { prompt: '$ traceglass app.log', output: 'HIGH finding' },
          },
          assets: [{ id: 'hero-terminal', kind: 'visual', ref: 'terminal', focalPoint: 'center' }],
        },
      ],
      assets: [{ id: 'hero-terminal', kind: 'visual', ref: 'terminal', owner: 'company' }],
      metadata: { canonical: '/home', socialImage: 'owned-asset' },
    };
    const key = richTextFieldKey('hero', ['data', 'heading']);
    const withCopy = withRichText(source, key, {
      version: 1,
      blocks: [
        {
          id: `${key}:block:0`,
          type: 'paragraph',
          children: [{ id: `${key}:block:0:text`, type: 'text', text: 'Updated', marks: ['bold'] }],
        },
      ],
    });

    const parsed = PageContent.parse(withCopy);
    expect(parsed.sections).toEqual(source.sections);
    expect(parsed.assets).toEqual(source.assets);
    expect(parsed.metadata).toEqual(source.metadata);
    expect(parsed.richText?.[key]?.blocks[0]?.type).toBe('paragraph');
  });

  it('rejects unsafe rich-text links at the shared API contract boundary', () => {
    const content = getDefaultMarketingPageContent('home');
    const key = richTextFieldKey('hero', ['data', 'body']);
    const invalid = withRichText(content, key, {
      version: 1,
      blocks: [
        {
          id: `${key}:block.0`,
          type: 'paragraph',
          children: [
            {
              id: `${key}:block.0:link.0`,
              type: 'link',
              href: 'javascript:alert(1)',
              children: [
                {
                  id: `${key}:block.0:link.0:text`,
                  type: 'text',
                  text: 'unsafe',
                  marks: [],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(PageUpdate.safeParse({ content: invalid }).success).toBe(false);
  });

  it('uses the legacy body only for a genuinely custom record', () => {
    const normalized = normalizeMarketingPageContent({
      title: 'Custom page',
      body: 'Legacy copy',
      seoDescription: 'Custom description',
    });
    expect(normalized.sections).toHaveLength(1);
    expect(normalized.sections[0]?.kind).toBe('legacy-body');
    expect(normalized.sections[0]?.data).toMatchObject({ body: 'Legacy copy' });
  });

  it('keeps watchlist, built-in, and local-only marketing language distinct', () => {
    const homeCopy = JSON.stringify(getDefaultMarketingPageContent('home')).toLowerCase();

    expect(homeCopy).toContain('local watchlist');
    expect(homeCopy).toContain('user-controlled');
    expect(homeCopy).toContain('curated built-in signatures');
    expect(homeCopy).toContain('versioned built-in signature catalog');
    expect(homeCopy).toContain('no ai');
    expect(homeCopy).toContain('no network');
    expect(homeCopy).toContain('candidate suggestions');
    expect(homeCopy).not.toMatch(/add highlight/);
  });
});
