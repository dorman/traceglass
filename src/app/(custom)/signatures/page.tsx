// @polsia:user-owned — metadata shell for the public signature library preview.

import type { Metadata } from 'next';
import { ExistingPageSurface } from '@/components/custom/marketing/existing-page-surface';

export const metadata: Metadata = {
  title: 'Signature library — TraceGlass',
  description:
    'Preview the v0.2.0 curated, versioned built-in signature library for Splunk search errors, Windows Event anomalies, and antivirus/EDR alerts. Built-ins produce findings and never enter your local watchlist.',
  alternates: { canonical: '/signatures' },
};

export default function SignaturesPage() {
  return <ExistingPageSurface sourceKey="signatures" />;
}
