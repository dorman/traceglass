// @polsia:user-owned — static shell for creating an owner-managed page.
import type { Metadata } from 'next';
import { PageEditor } from '@/components/custom/admin/page-editor';

export const metadata: Metadata = {
  title: 'New marketing page',
  description: 'Draft a new TraceGlass marketing page.',
};

export default function NewAdminPage() {
  return (
    <main className="section">
      <PageEditor />
    </main>
  );
}
