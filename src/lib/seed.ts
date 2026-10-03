// @polsia:user-owned — deploy-time database seed. You OWN this file.
//
// seed() runs once when the server boots (via the framework-owned
// src/instrumentation.ts), on the Node server, AFTER the schema is applied. Use it
// for reference/lookup data your app needs to exist BEFORE the first request:
// plans, categories, feature defaults, a first admin row, etc. Read/write the DB
// through the Prisma singleton in @/lib/db (server startup — there is no request,
// so this does NOT go through /api).
//
// RULES — this runs on EVERY deploy/boot, possibly more than once, possibly on more
// than one instance at the same time:
//   1. Make every write IDEMPOTENT — upsert (`where` + `create` + `update`) or
//      `createMany({ ..., skipDuplicates: true })`, NEVER a bare `create`/`insert`.
//   2. Keep it fast and small — it runs before the server serves traffic.
//   3. NOT for recurring work (that's polsia.toml `[[crons]]`) or per-user/
//      request-time logic (that's an /api route handler). There is no request here.
//
// The template ships an empty seed (a no-op). Fill in the body when your app needs
// it; leave it empty to keep seeding off. Don't delete the file — instrumentation.ts
// imports it.
import type { Prisma } from '@prisma/client';

const technicalBrandKeys = new Set([
  'command',
  'docsUrl',
  'downloadUrl',
  'href',
  'installerName',
  'prompt',
  'ref',
  'signingKeyId',
]);

type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };

function renameVisibleBrandText(value: string): string {
  return value
    .split(/(`[^`]*`|https?:\/\/\S+|~\/\.loglens\S*)/g)
    .map((part, index) =>
      index % 2 === 1 ? part : part.replace(/\b(loglens|logsift)\b/gi, 'TraceGlass'),
    )
    .join('');
}

function renameVisibleBrand(value: JsonValue, key = ''): JsonValue {
  if (typeof value === 'string') {
    return technicalBrandKeys.has(key) ? value : renameVisibleBrandText(value);
  }
  if (Array.isArray(value)) return value.map((item) => renameVisibleBrand(item));
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      renameVisibleBrand(entryValue, entryKey),
    ]),
  );
}

function brandingUpdate(page: {
  title: string;
  body: string;
  seoDescription: string;
  content: Prisma.JsonValue | null;
}) {
  const content = page.content === null ? null : renameVisibleBrand(page.content as JsonValue);
  const next = {
    title: renameVisibleBrandText(page.title),
    body: renameVisibleBrandText(page.body),
    seoDescription: renameVisibleBrandText(page.seoDescription),
    content,
  };
  return JSON.stringify(next) ===
    JSON.stringify({
      title: page.title,
      body: page.body,
      seoDescription: page.seoDescription,
      content: page.content,
    })
    ? null
    : next;
}

export async function seed(): Promise<void> {
  const { Prisma } = await import('@prisma/client');
  const { prisma } = await import('@/lib/db');
  const { existingMarketingPages } = await import('@/lib/marketing-page-registry');
  const {
    cleanupRetiredPricingContent,
    normalizeMarketingPageContent,
    reconcileGeneratedWaitlistCopy,
  } = await import('@/lib/marketing-page-content');

  const contentFor = (template: (typeof existingMarketingPages)[number]) =>
    JSON.parse(JSON.stringify(template.content));

  const isUntouchedGeneratedRecord = (page: { createdAt: Date; updatedAt: Date }) =>
    page.createdAt.getTime() === page.updatedAt.getTime();

  for (const template of existingMarketingPages) {
    const content = contentFor(template);
    try {
      await prisma.marketingPage.upsert({
        where: { id: template.id },
        create: {
          id: template.id,
          title: template.title,
          slug: template.slug,
          body: template.body,
          seoDescription: template.seoDescription,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          sourceKey: template.sourceKey,
          sourcePath: template.sourcePath,
          templateKey: template.templateKey,
          content,
        },
        update: {},
      });
      const seeded = await prisma.marketingPage.findUnique({ where: { id: template.id } });
      if (seeded && isUntouchedGeneratedRecord(seeded)) {
        await prisma.marketingPage.update({
          where: { id: template.id },
          data: {
            title: template.title,
            body: template.body,
            seoDescription: template.seoDescription,
            status: 'PUBLISHED',
            publishedAt: seeded.publishedAt ?? new Date(),
            sourceKey: template.sourceKey,
            sourcePath: template.sourcePath,
            templateKey: template.templateKey,
            content,
          },
        });
      } else if (seeded?.content === null) {
        await prisma.marketingPage.update({
          where: { id: seeded.id },
          data: { content },
        });
      } else if (seeded) {
        const update = brandingUpdate(seeded);
        if (update) {
          await prisma.marketingPage.update({
            where: { id: seeded.id },
            data: {
              ...update,
              content: update.content as Prisma.InputJsonValue,
            },
          });
        }
      }
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        continue;
      }

      const existing = await prisma.marketingPage.findFirst({
        where: { OR: [{ slug: template.slug }, { sourceKey: template.sourceKey }] },
      });
      if (!existing) continue;
      const untouched = isUntouchedGeneratedRecord(existing);
      await prisma.marketingPage.update({
        where: { id: existing.id },
        data: {
          ...(untouched
            ? {
                title: template.title,
                body: template.body,
                seoDescription: template.seoDescription,
                status: 'PUBLISHED',
                publishedAt: existing.publishedAt ?? new Date(),
                sourceKey: template.sourceKey,
                sourcePath: template.sourcePath,
                templateKey: template.templateKey,
              }
            : {
                sourceKey: existing.sourceKey ?? template.sourceKey,
                sourcePath: existing.sourcePath ?? template.sourcePath,
                templateKey: existing.templateKey ?? template.templateKey,
              }),
          ...(untouched || existing.content === null
            ? {
                content: untouched
                  ? content
                  : JSON.parse(
                      JSON.stringify(
                        normalizeMarketingPageContent({
                          title: existing.title,
                          body: existing.body,
                          seoDescription: existing.seoDescription,
                          templateKey: existing.templateKey ?? template.templateKey,
                          sourceKey: existing.sourceKey ?? template.sourceKey,
                          content: template.content,
                        }),
                      ),
                    ),
              }
            : {}),
        },
      });
    }
  }

  for (const sourceKey of ['home', 'release'] as const) {
    const template = existingMarketingPages.find((page) => page.sourceKey === sourceKey);
    if (!template) continue;
    const page = await prisma.marketingPage.findFirst({
      where: {
        OR: [
          { id: template.id },
          { sourceKey },
          { sourcePath: template.sourcePath },
          { slug: template.slug },
        ],
      },
    });
    if (!page) continue;

    const cleanup = cleanupRetiredPricingContent({
      sourceKey,
      title: page.title,
      content: page.content,
    });
    if (!cleanup.titleChanged && !cleanup.contentChanged) continue;

    await prisma.marketingPage.update({
      where: { id: page.id },
      data: {
        ...(cleanup.titleChanged ? { title: cleanup.title } : {}),
        ...(cleanup.contentChanged ? { content: cleanup.content as Prisma.InputJsonValue } : {}),
      },
    });
  }

  const waitlistTemplate = existingMarketingPages.find((page) => page.sourceKey === 'waitlist');
  if (waitlistTemplate) {
    const waitlistPage = await prisma.marketingPage.findFirst({
      where: {
        OR: [
          { id: waitlistTemplate.id },
          { sourceKey: 'waitlist' },
          { sourcePath: waitlistTemplate.sourcePath },
          { slug: waitlistTemplate.slug },
        ],
      },
    });
    if (waitlistPage) {
      const reconciliation = reconcileGeneratedWaitlistCopy(waitlistPage);
      if (reconciliation.changed) {
        await prisma.marketingPage.update({
          where: { id: waitlistPage.id },
          data: {
            title: reconciliation.title,
            body: reconciliation.body,
            seoDescription: reconciliation.seoDescription,
            ...(reconciliation.contentChanged
              ? { content: reconciliation.content as Prisma.InputJsonValue }
              : {}),
          },
        });
      }
    }
  }

  await prisma.marketingPage.updateMany({
    where: {
      AND: [
        { OR: [{ slug: 'billing' }, { sourceKey: 'billing' }, { sourcePath: '/billing' }] },
        { OR: [{ status: 'PUBLISHED' }, { publishedAt: { not: null } }] },
      ],
    },
    data: { status: 'DRAFT', publishedAt: null },
  });
}
