// @polsia:user-owned — Stripe Checkout success page (redirect target from
// Stripe). Server Component that reads ?session_id=, calls the framework-owned
// /api/stripe-billing/verify via fetch (the framework installs that route),
// and renders the verification result.

import { CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Subscription confirmed',
  alternates: { canonical: '/billing/checkout/success' },
};

interface VerifyOk {
  verified: true;
  payment: {
    amount_usd: number;
    customer_email?: string;
  };
}
interface VerifyErr {
  verified: false;
  error: string;
}
type VerifyResult = VerifyOk | VerifyErr;

async function verifySession(sessionId: string): Promise<VerifyResult> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/stripe-billing/verify?session_id=${encodeURIComponent(sessionId)}`,
      { cache: 'no-store' },
    );
    return (await res.json()) as VerifyResult;
  } catch {
    return { verified: false, error: 'verify_unreachable' };
  }
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id;
  const result = sessionId ? await verifySession(sessionId) : null;
  const email =
    result && 'verified' in result && result.verified ? result.payment.customer_email : null;

  return (
    <main className="dark section-lg min-h-[calc(100vh-7rem)] bg-zinc-950 text-zinc-100">
      <div className="container-page flex flex-col items-start gap-6">
        <CheckCircle2 aria-hidden="true" className="size-12 text-brand-500" />
        <h1 className="text-h1 font-display">You&apos;re in.</h1>
        {result?.verified ? (
          <p className="text-body-lg text-muted-foreground">
            Subscription confirmed{email ? ` for ${email}` : ''}. The curated pack is on the way —
            it stays separate from your editable local watchlist; drop it in{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.95em]">
              ~/.config/traceglass/curated/
            </code>{' '}
            and run the CLI as usual.
          </p>
        ) : (
          <p className="text-body-lg text-muted-foreground">
            Stripe reports the payment as completed. The curated pack will arrive shortly; it stays
            separate from your editable local watchlist. If it doesn&apos;t, write to{' '}
            <a
              href="mailto:traceglass@polsia.app"
              className="font-medium text-brand-700 underline-offset-4 hover:underline dark:text-brand-300"
            >
              traceglass@polsia.app
            </a>{' '}
            with your receipt.
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button asChild size="lg">
            <Link href="/#workflow">Back to the CLI</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
