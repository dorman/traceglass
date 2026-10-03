// @polsia:user-owned — TraceGlass marketing landing page, served at /.
// Server Component so it can export metadata. Composed of section Server
// Components imported from src/components/custom/marketing/*.

import type { Metadata } from 'next';
import { ExistingPageSurface } from '@/components/custom/marketing/existing-page-surface';
import { siteDescription, siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: siteName },
  description: siteDescription,
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return <ExistingPageSurface sourceKey="home" />;
}
