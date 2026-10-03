// @polsia:user-owned — client-safe owner access probe.
import 'server-only';

import { NextResponse } from 'next/server';
import { getPageOwnerStatus } from '@/lib/page-owner';

export async function GET() {
  try {
    return NextResponse.json({ isOwner: await getPageOwnerStatus() });
  } catch {
    return NextResponse.json({ isOwner: false });
  }
}
