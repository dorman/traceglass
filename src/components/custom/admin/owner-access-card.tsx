// @polsia:user-owned — shared owner-access denial card for the admin islands.
'use client';

import Link from 'next/link';
import { EmailVerification } from '@/components/custom/email-verification';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePageOwner } from '@/hooks/use-page-owner';
import { useSession } from '@/lib/auth-client';

// One card for every owner-gated admin surface. It separates the three denial
// causes using only facts the session already exposes: anonymous visitors get a
// return-aware sign-in link, a signed-in unverified account gets the trusted
// emailed-verification step, and a verified non-owner gets the strict denial.
// The configured owner address itself is never revealed.
export function OwnerAccessCard({ returnTo = '/admin/pages' }: { returnTo?: string }) {
  const { isOwner, isLoading: ownerLoading } = usePageOwner();
  const { data: session, isPending: sessionLoading } = useSession();
  const user = session?.user;

  if (ownerLoading || sessionLoading) {
    return <p className="text-muted-foreground">Checking owner access…</p>;
  }

  if (isOwner) return null;

  if (!user) {
    return (
      <Card className="border-brand-200/60 bg-card/80 shadow-lg">
        <CardHeader>
          <CardTitle className="font-display text-h3">Owner access required</CardTitle>
          <CardDescription>
            Sign in with the verified TraceGlass owner account to manage public pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Until the email is verified we cannot tell whether this account is the
  // owner, so the verification step comes before any non-owner conclusion.
  if (user.emailVerified !== true) {
    return (
      <Card className="border-brand-200/60 bg-card/80 shadow-lg">
        <CardHeader>
          <CardTitle className="font-display text-h3">Owner access required</CardTitle>
          <CardDescription>
            This account&apos;s email address is not verified yet. Verification is required to
            manage TraceGlass pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailVerification email={user.email} callbackURL={returnTo} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand-200/60 bg-card/80 shadow-lg">
      <CardHeader>
        <CardTitle className="font-display text-h3">Owner access required</CardTitle>
        <CardDescription>
          This signed-in account does not have access to manage TraceGlass pages.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
