// @polsia:user-owned — static shell for the protected page preview.
import type { Metadata } from 'next';
import { PagePreview } from '@/components/custom/admin/page-preview';

export const metadata: Metadata = {
  title: 'Preview marketing page',
  description: 'Preview a TraceGlass marketing page before publishing.',
};

export default async function PreviewAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="section">
      <PagePreview pageId={id} />
    </main>
  );
}
