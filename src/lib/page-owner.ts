// @polsia:user-owned — owner-only authorization for the marketing page editor.
import 'server-only';

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { isVerifiedPageOwner } from '@/lib/page-owner-policy';

export { isVerifiedPageOwner } from '@/lib/page-owner-policy';

export async function getPageOwnerStatus(): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() });
  return isVerifiedPageOwner(
    session?.user?.email,
    session?.user?.emailVerified,
    env.POLSIA_OWNER_EMAIL,
  );
}

export async function requirePageOwner() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (
    !isVerifiedPageOwner(session.user.email, session.user.emailVerified, env.POLSIA_OWNER_EMAIL)
  ) {
    throw NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return session.user;
}
