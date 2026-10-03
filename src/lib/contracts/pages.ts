// @polsia:user-owned — shared client-safe contract for managed marketing pages.
// Keep this module free of server-only imports so routes and client islands can
// validate the same payloads at both sides of the data boundary.
import { z } from 'zod';

export const PageStatus = z.enum(['DRAFT', 'PUBLISHED']);

const title = z.string().trim().min(1, 'Title is required').max(120, 'Title is too long');
const slug = z
  .string()
  .trim()
  .min(1, 'Slug is required')
  .max(120, 'Slug is too long')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only');
const body = z.string().trim().min(1, 'Body is required').max(50_000, 'Body is too long');
const seoDescription = z
  .string()
  .trim()
  .min(1, 'SEO description is required')
  .max(160, 'SEO description is too long');
const isoDate = z.string().datetime({ offset: true });

const assetReference = z
  .object({
    id: z.string().min(1),
    kind: z.string().min(1),
    ref: z.string().optional(),
    url: z.string().url().optional(),
    alt: z.string().optional(),
  })
  .passthrough();

const richTextMark = z.enum(['bold', 'italic']);
const richTextHref = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    if (/^(?:\/(?!\/)|#|\?|\.\/|\.\.\/)/.test(value)) return true;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Use an internal route or an HTTPS URL');
const richTextText = z.object({
  id: z.string().min(1),
  type: z.literal('text'),
  text: z.string(),
  marks: z.array(richTextMark),
});
const richTextLink = z.object({
  id: z.string().min(1),
  type: z.literal('link'),
  href: richTextHref,
  children: z.array(richTextText).min(1),
});
const richTextInline = z.discriminatedUnion('type', [richTextText, richTextLink]);
const richTextListItem = z.object({
  id: z.string().min(1),
  type: z.literal('list-item'),
  children: z.array(richTextInline),
});
const richTextParagraph = z.object({
  id: z.string().min(1),
  type: z.literal('paragraph'),
  children: z.array(richTextInline),
});
const richTextHeading = z.object({
  id: z.string().min(1),
  type: z.literal('heading'),
  level: z.number().int().min(1).max(3),
  children: z.array(richTextInline),
});
const richTextList = z.object({
  id: z.string().min(1),
  type: z.literal('list'),
  ordered: z.boolean(),
  items: z.array(richTextListItem),
});
const richTextBlock = z.discriminatedUnion('type', [
  richTextParagraph,
  richTextHeading,
  richTextList,
]);

export const RichTextDocument = z.object({
  version: z.literal(1),
  blocks: z.array(richTextBlock),
});

export const RichTextMap = z.record(z.string().min(1), RichTextDocument);

export const SectionLayoutPreset = z.enum(['one-column', 'two-columns', 'three-columns']);

export const SECTION_LAYOUT_KINDS = [
  'features',
  'use-cases',
  'how-it-works',
  'privacy',
  'pricing',
  'release-install',
] as const;

const sectionLayoutKinds = new Set<string>(SECTION_LAYOUT_KINDS);

const contentSection = z
  .object({
    id: z.string().min(1),
    kind: z.string().min(1),
    data: z.record(z.unknown()),
    assets: z.array(assetReference),
    layout: SectionLayoutPreset.optional(),
  })
  .passthrough()
  .superRefine((section, context) => {
    if (section.layout && !sectionLayoutKinds.has(section.kind)) {
      context.addIssue({
        code: 'custom',
        path: ['layout'],
        message: 'This section does not support a column layout',
      });
    }
  });

export const PageContent = z
  .object({
    version: z.literal(1),
    sections: z.array(contentSection),
    assets: z.array(assetReference),
    richText: RichTextMap.optional(),
  })
  .passthrough();

export const PageCreate = z.object({
  title,
  slug,
  body,
  seoDescription,
  content: PageContent.optional(),
});

export const PageUpdate = z
  .object({
    title: title.optional(),
    slug: slug.optional(),
    body: body.optional(),
    seoDescription: seoDescription.optional(),
    content: PageContent.optional(),
    status: PageStatus.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const PageListItem = z.object({
  id: z.string(),
  title,
  slug,
  status: PageStatus,
  publishedAt: isoDate.nullable(),
  updatedAt: isoDate,
  sourceKey: z.string().nullable(),
  sourcePath: z.string().nullable(),
  templateKey: z.string().nullable(),
  hasDraft: z.boolean(),
});

export const PageDetail = PageListItem.extend({
  body,
  seoDescription,
  content: PageContent,
  createdAt: isoDate,
});

export const PageList = z.object({
  items: z.array(PageListItem),
});

export const PageDetailResponse = PageDetail;

export const PublicPage = z.object({
  id: z.string(),
  title,
  slug,
  body,
  seoDescription,
  content: PageContent,
  publishedAt: isoDate,
  sourceKey: z.string().nullable(),
  sourcePath: z.string().nullable(),
  templateKey: z.string().nullable(),
});

export const PageOwnerAccess = z.object({ isOwner: z.boolean() });

export type PageStatus = z.infer<typeof PageStatus>;
export type PageCreate = z.infer<typeof PageCreate>;
export type PageUpdate = z.infer<typeof PageUpdate>;
export type PageListItem = z.infer<typeof PageListItem>;
export type PageDetail = z.infer<typeof PageDetail>;
export type PageList = z.infer<typeof PageList>;
export type PublicPage = z.infer<typeof PublicPage>;
export type PageOwnerAccess = z.infer<typeof PageOwnerAccess>;
export type PageContent = z.infer<typeof PageContent>;
export type PageContentSection = z.infer<typeof contentSection>;
export type SectionLayoutPreset = z.infer<typeof SectionLayoutPreset>;
export type PageAssetReference = z.infer<typeof assetReference>;
export type RichTextMark = z.infer<typeof richTextMark>;
export type RichTextText = z.infer<typeof richTextText>;
export type RichTextLink = z.infer<typeof richTextLink>;
export type RichTextInline = z.infer<typeof richTextInline>;
export type RichTextListItem = z.infer<typeof richTextListItem>;
export type RichTextBlock = z.infer<typeof richTextBlock>;
export type RichTextDocument = z.infer<typeof RichTextDocument>;
export type RichTextMap = z.infer<typeof RichTextMap>;
