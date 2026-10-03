// @polsia:user-owned — metadata shell for the public TraceGlass paid-plan updates page.
import type { Metadata } from 'next';
import { ExistingPageSurface } from '@/components/custom/marketing/existing-page-surface';

export const metadata: Metadata = {
  title: 'TraceGlass paid plan updates',
  description:
    'A paid TraceGlass plan is planned, but it isn’t available yet. Request one email update; signup does not start a subscription. Target launch date: November 15, 2026.',
  alternates: { canonical: '/waitlist' },
  openGraph: {
    title: 'TraceGlass paid plan updates',
    description:
      'A paid TraceGlass plan is planned, but it isn’t available yet. Request one email update; signup does not start a subscription. Target launch date: November 15, 2026.',
    url: '/waitlist',
  },
};

export default function WaitlistPage() {
  return <ExistingPageSurface sourceKey="waitlist" />;
}
