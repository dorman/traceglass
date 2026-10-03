// @polsia:user-owned — static shell for the owner page index.
import type { Metadata } from 'next';
import { PageListView } from '@/components/custom/admin/page-list';

export const metadata: Metadata = {
  title: 'Manage pages',
  description: 'Create, edit, publish, preview, and remove TraceGlass marketing pages.',
};

export default function AdminPagesPage() {
  return (
    <main className="section">
      <div className="container-page">
        <PageListView />
      </div>
    </main>
  );
}
