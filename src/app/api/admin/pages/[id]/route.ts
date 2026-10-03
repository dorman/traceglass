// @polsia:user-owned — owner-only marketing page item API.
import 'server-only';

import { MarketingPageStatus, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pageDetail } from '@/app/api/admin/pages/route';
import { PageUpdate } from '@/lib/contracts/pages';
import { prisma } from '@/lib/db';
import { normalizeMarketingPageContent } from '@/lib/marketing-page-content';
import { requirePageOwner } from '@/lib/page-owner';

type RouteContext = { params: Promise<{ id: string }> };
const pageId = z.string().min(1).max(64);

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

async function findPage(id: string) {
  return prisma.marketingPage.findUnique({ where: { id }, include: { draft: true } });
}

function effectiveField(
  current: Awaited<ReturnType<typeof findPage>>,
  field: 'title' | 'slug' | 'body' | 'seoDescription',
  patch: Partial<Record<'title' | 'slug' | 'body' | 'seoDescription', string>>,
) {
  if (!current) return '';
  return patch[field] ?? current.draft?.[field] ?? current[field];
}

function effectiveContent(current: Awaited<ReturnType<typeof findPage>>, patch: unknown) {
  if (!current) return normalizeMarketingPageContent({ title: '', body: '' });
  const values = current.draft ?? current;
  return normalizeMarketingPageContent({
    title: values.title,
    body: values.body,
    seoDescription: values.seoDescription,
    templateKey: current.templateKey,
    sourceKey: current.sourceKey,
    content: patch ?? values.content,
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const denied = await ownerResponse();
  if (denied) return denied;

  try {
    const { id } = await context.params;
    if (!pageId.safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid page id' }, { status: 400 });
    }
    const page = await findPage(id);
    if (!page) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    return NextResponse.json(pageDetail(page));
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await ownerResponse();
  if (denied) return denied;

  try {
    const { id } = await context.params;
    if (!pageId.safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid page id' }, { status: 400 });
    }
    const parsed = PageUpdate.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json(validationErrors(parsed.error), { status: 400 });

    const current = await findPage(id);
    if (!current) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    const { status, content: contentPatch, ...fieldPatch } = parsed.data;
    const useDraft = current.status === MarketingPageStatus.PUBLISHED || current.sourceKey !== null;

    if (useDraft) {
      const values = {
        title: effectiveField(current, 'title', fieldPatch),
        slug: effectiveField(current, 'slug', fieldPatch),
        body: effectiveField(current, 'body', fieldPatch),
        seoDescription: effectiveField(current, 'seoDescription', fieldPatch),
        content: effectiveContent(current, contentPatch),
      };

      const result = await prisma.$transaction(async (transaction) => {
        if (status === 'PUBLISHED') {
          await transaction.marketingPage.update({
            where: { id },
            data: {
              ...values,
              status: MarketingPageStatus.PUBLISHED,
              publishedAt: current.publishedAt ?? new Date(),
              content: JSON.parse(JSON.stringify(values.content)) as Prisma.InputJsonValue,
            },
          });
          await transaction.marketingPageDraft.deleteMany({ where: { pageId: id } });
        } else {
          await transaction.marketingPageDraft.upsert({
            where: { pageId: id },
            create: {
              pageId: id,
              title: values.title,
              slug: values.slug,
              body: values.body,
              seoDescription: values.seoDescription,
              content: JSON.parse(JSON.stringify(values.content)) as Prisma.InputJsonValue,
            },
            update: {
              title: values.title,
              slug: values.slug,
              body: values.body,
              seoDescription: values.seoDescription,
              content: JSON.parse(JSON.stringify(values.content)) as Prisma.InputJsonValue,
            },
          });
          if (status === 'DRAFT') {
            await transaction.marketingPage.update({
              where: { id },
              data: { status: MarketingPageStatus.DRAFT, publishedAt: null },
            });
          }
        }
        return transaction.marketingPage.findUnique({
          where: { id },
          include: { draft: true },
        });
      });

      if (!result) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
      return NextResponse.json(pageDetail(result));
    }

    const data: Prisma.MarketingPageUpdateInput = {
      ...fieldPatch,
      content: JSON.parse(
        JSON.stringify(effectiveContent(current, contentPatch)),
      ) as Prisma.InputJsonValue,
    };
    if (status !== undefined) {
      data.status =
        status === 'PUBLISHED' ? MarketingPageStatus.PUBLISHED : MarketingPageStatus.DRAFT;
      data.publishedAt = status === 'PUBLISHED' ? (current.publishedAt ?? new Date()) : null;
    }
    const page = await prisma.marketingPage.update({
      where: { id },
      data,
      include: { draft: true },
    });
    return NextResponse.json(pageDetail(page));
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

export async function DELETE(_request: Request, context: RouteContext) {
  const denied = await ownerResponse();
  if (denied) return denied;

  try {
    const { id } = await context.params;
    if (!pageId.safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid page id' }, { status: 400 });
    }
    const result = await prisma.marketingPage.deleteMany({ where: { id } });
    if (result.count === 0) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
