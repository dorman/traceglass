// @polsia:user-owned — metadata shell for the public TraceGlass install guide.
// The interactive island owns the public read through /api/install.

import type { Metadata } from 'next';
import { ExistingPageSurface } from '@/components/custom/marketing/existing-page-surface';

export const metadata: Metadata = {
  title: 'Install TraceGlass — one-click beta installer',
  description:
    'Install TraceGlass with the planned one-click beta installer for supported Linux, macOS, and Windows targets, or use the technical source fallback.',
  alternates: { canonical: '/install' },
};

export default function InstallPage() {
  return <ExistingPageSurface sourceKey="install" />;
}
