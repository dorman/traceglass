// @polsia:user-owned — owner-only marketing page collection API.
import 'server-only';

import { MarketingPageStatus, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { PageCreate, PageDetail, PageList } from '@/lib/contracts/pages';
import { prisma } from '@/lib/db';
import { normalizeMarketingPageContent } from '@/lib/marketing-page-content';
import { requirePageOwner } from '@/lib/page-owner';

function validationErrors(error: { flatten: () => { fieldErrors: Record<string, string[]> } }) {
  const fieldErrors = error.flatten().fieldErrors;
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    const message = messages[0];
    if (message) errors[field] = message;
  }
  return { errors };
}

async function ownerResponse(): Promise<Response | null> {
  try {
    await requirePageOwner();
    return null;
  } catch (response) {
    return response as Response;
  }
}

function effectiveValues(page: {
  title: string;
  slug: string;
  body: string;
  seoDescription: string;
  content: unknown;
  draft: {
    title: string;
    slug: string;
    body: string;
    seoDescription: string;
    content: unknown;
  } | null;
}) {
  return page.draft ?? page;
}

function listItem(page: {
  id: string;
  title: string;
  slug: string;
  body: string;
  seoDescription: string;
  status: MarketingPageStatus;
  publishedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  sourceKey: string | null;
  sourcePath: string | null;
  templateKey: string | null;
  content: unknown;
  draft: {
    title: string;
    slug: string;
    body: string;
    seoDescription: string;
    content: unknown;
  } | null;
}) {
  const values = effectiveValues(page);
  return {
    id: page.id,
    title: values.title,
    slug: values.slug,
    status: page.status,
    publishedAt: page.publishedAt?.toISOString() ?? null,
    updatedAt: page.updatedAt.toISOString(),
    sourceKey: page.sourceKey,
    sourcePath: page.sourcePath,
    templateKey: page.templateKey,
    hasDraft: page.draft !== null,
  };
}

export function pageDetail(page: Parameters<typeof listItem>[0]) {
  const values = effectiveValues(page);
  const content = normalizeMarketingPageContent({
    title: values.title,
    body: values.body,
    seoDescription: values.seoDescription,
    templateKey: page.templateKey,
    sourceKey: page.sourceKey,
    content: values.content,
  });
  return PageDetail.parse({
    ...listItem(page),
    body: values.body,
    seoDescription: values.seoDescription,
    content,
    createdAt: page.createdAt.toISOString(),
  });
}

export async function GET() {
  const denied = await ownerResponse();
  if (denied) return denied;

  try {
    const pages = await prisma.marketingPage.findMany({
      include: { draft: true },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(PageList.parse({ items: pages.map(listItem) }));
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await ownerResponse();
  if (denied) return denied;

  try {
    const parsed = PageCreate.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json(validationErrors(parsed.error), { status: 400 });

    const content = normalizeMarketingPageContent({
      ...parsed.data,
      templateKey: null,
      sourceKey: null,
    });
    const page = await prisma.marketingPage.create({
      data: {
        title: parsed.data.title,
        slug: parsed.data.slug,
        body: parsed.data.body,
        seoDescription: parsed.data.seoDescription,
        content: JSON.parse(
          JSON.stringify(parsed.data.content ?? content),
        ) as Prisma.InputJsonValue,
        status: MarketingPageStatus.DRAFT,
        publishedAt: null,
      },
      include: { draft: true },
    });
    return NextResponse.json(pageDetail(page), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { errors: { slug: 'That slug is already in use' } },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
