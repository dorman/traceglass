// @polsia:user-owned — static shell for a published managed marketing page.
import type { Metadata } from 'next';
import { ManagedPage } from '@/components/custom/marketing/managed-page';

export const metadata: Metadata = {
  title: 'Managed page',
  description: 'A published TraceGlass marketing page.',
};

export default async function ManagedPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ManagedPage slug={slug} />;
}
