// @polsia:user-owned — public published marketing page API.
import 'server-only';

import { MarketingPageStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { PublicPage } from '@/lib/contracts/pages';
import { prisma } from '@/lib/db';
import { normalizeMarketingPageContent } from '@/lib/marketing-page-content';
import { findExistingMarketingPage } from '@/lib/marketing-page-registry';

type RouteContext = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const template = findExistingMarketingPage(slug);
    const aliases = template
      ? [template.sourceKey, template.sourcePath, template.slug, ...template.legacySlugs]
      : [slug];
    const page = await prisma.marketingPage.findFirst({
      where: {
        status: MarketingPageStatus.PUBLISHED,
        OR: [
          { slug },
          ...aliases.map((alias) => ({ sourceKey: alias })),
          ...aliases.map((alias) => ({ sourcePath: alias })),
        ],
      },
    });
    if (!page?.publishedAt) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    return NextResponse.json(
      PublicPage.parse({
        id: page.id,
        title: page.title,
        slug: page.slug,
        body: page.body,
        seoDescription: page.seoDescription,
        content: normalizeMarketingPageContent({
          title: page.title,
          body: page.body,
          seoDescription: page.seoDescription,
          templateKey: page.templateKey,
          sourceKey: page.sourceKey,
          content: page.content,
        }),
        publishedAt: page.publishedAt.toISOString(),
        sourceKey: page.sourceKey,
        sourcePath: page.sourcePath,
        templateKey: page.templateKey,
      }),
    );
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
