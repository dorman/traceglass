// @polsia:user-owned — owner-only site appearance read and update API.
import 'server-only';

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import {
  resolveSiteDesign,
  SITE_DESIGN_SINGLETON_ID,
  SiteDesignResponse,
  SiteDesignSchema,
} from '@/lib/contracts/site-design';
import { prisma } from '@/lib/db';
import { requirePageOwner } from '@/lib/page-owner';

async function ownerResponse(): Promise<Response | null> {
  try {
    await requirePageOwner();
    return null;
  } catch (error) {
    return error instanceof Response
      ? error
      : NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function currentResponse() {
  const record = await prisma.siteDesign.findUnique({
    where: { id: SITE_DESIGN_SINGLETON_ID },
    select: { settings: true, updatedAt: true },
  });
  return SiteDesignResponse.parse({
    design: resolveSiteDesign(record?.settings),
    updatedAt: record?.updatedAt.toISOString() ?? null,
  });
}

export async function GET() {
  const denied = await ownerResponse();
  if (denied) return denied;

  try {
    return NextResponse.json(await currentResponse());
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await ownerResponse();
  if (denied) return denied;

  const parsed = SiteDesignSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
      const message = messages[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    const settings = JSON.parse(JSON.stringify(parsed.data)) as Prisma.InputJsonValue;
    const record = await prisma.siteDesign.upsert({
      where: { id: SITE_DESIGN_SINGLETON_ID },
      create: { id: SITE_DESIGN_SINGLETON_ID, settings },
      update: { settings },
      select: { settings: true, updatedAt: true },
    });
    return NextResponse.json(
      SiteDesignResponse.parse({
        design: resolveSiteDesign(record.settings),
        updatedAt: record.updatedAt.toISOString(),
      }),
    );
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
