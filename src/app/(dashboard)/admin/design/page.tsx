// @polsia:user-owned — static shell for the owner website design editor.
import type { Metadata } from 'next';
import { SiteDesignEditor } from '@/components/custom/admin/site-design-editor';

export const metadata: Metadata = {
  title: 'Website design',
  description: 'Preview and update TraceGlass colors, typography, and component treatments.',
};

export default function AdminDesignPage() {
  return (
    <main className="section">
      <div className="container-page">
        <SiteDesignEditor />
      </div>
    </main>
  );
}
