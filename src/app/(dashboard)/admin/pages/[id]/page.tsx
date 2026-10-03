// @polsia:user-owned — static shell for editing an owner-managed page.
import type { Metadata } from 'next';
import { PageEditor } from '@/components/custom/admin/page-editor';

export const metadata: Metadata = {
  title: 'Edit marketing page',
  description: 'Edit and publish a TraceGlass marketing page.',
};

export default async function EditAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="section">
      <PageEditor pageId={id} />
    </main>
  );
}
