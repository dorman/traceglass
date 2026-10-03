// @polsia:user-owned — Stripe Checkout cancel page (redirect target from
// Stripe when the buyer backs out). Directs visitors to the Notify Me signup.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Checkout cancelled',
  alternates: { canonical: '/billing/checkout/cancelled' },
};

export default function CheckoutCancelledPage() {
  return (
    <main className="section">
      <div className="container-page flex max-w-2xl flex-col items-start gap-6">
        <h1 className="text-h2 font-display">Checkout cancelled</h1>
        <p className="text-body-lg text-muted-foreground">
          You weren&apos;t charged — Stripe cancelled the checkout before payment. Whenever
          you&apos;re ready, come back and the core binary will still be there for free.
        </p>
        <div className="flex gap-3 pt-2">
          <Button asChild>
            <Link href="/waitlist">Notify me</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
