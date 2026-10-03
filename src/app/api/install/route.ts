// @polsia:user-owned — public read-only install catalog for the TraceGlass CLI.
import 'server-only';

import { NextResponse } from 'next/server';
import { InstallGuideResponse } from '@/lib/contracts/install';
import { installCatalog } from '@/lib/install-catalog';

export function GET() {
  const result = InstallGuideResponse.safeParse(installCatalog);
  if (!result.success) {
    return NextResponse.json(
      { status: 'unavailable', message: 'The release catalog is not valid.' },
      { status: 503 },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
