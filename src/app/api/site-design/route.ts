// @polsia:user-owned — public read-only access to the validated site appearance.
import 'server-only';

import { NextResponse } from 'next/server';
import {
  resolveSiteDesign,
  SITE_DESIGN_SINGLETON_ID,
  SiteDesignResponse,
} from '@/lib/contracts/site-design';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const record = await prisma.siteDesign.findUnique({
      where: { id: SITE_DESIGN_SINGLETON_ID },
      select: { settings: true, updatedAt: true },
    });
    return NextResponse.json(
      SiteDesignResponse.parse({
        design: resolveSiteDesign(record?.settings),
        updatedAt: record?.updatedAt.toISOString() ?? null,
      }),
    );
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
