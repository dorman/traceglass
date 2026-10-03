// @polsia:user-owned — metadata shell for the public release notes page.
import type { Metadata } from 'next';
import { ExistingPageSurface } from '@/components/custom/marketing/existing-page-surface';

export const metadata: Metadata = {
  title: 'Release status — TraceGlass',
  description:
    'Release status for the TraceGlass one-click beta installer, signed artifact plan, local-only behavior, and CLI fallback.',
  alternates: { canonical: '/release' },
};

export default function ReleasePage() {
  return <ExistingPageSurface sourceKey="release" />;
}
