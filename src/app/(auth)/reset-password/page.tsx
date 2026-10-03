// @polsia:user-owned
import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/custom/reset-password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Choose a new password — TraceGlass',
  description: 'Set a new password for your TraceGlass account using a secure reset link.',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--background)] px-gutter py-section">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-[-30%] h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-[var(--brand-100)] opacity-40 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-[var(--brand-200)] opacity-30 blur-3xl" />
      </div>
      <Card className="relative w-full max-w-md border border-border/60 bg-card/95 shadow-brand backdrop-blur-sm">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="text-h4">Choose a new password</CardTitle>
          <CardDescription>Your reset link is private and can be used only once.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <ResetPasswordForm token={query.token} invalidLink={query.error === 'INVALID_TOKEN'} />
        </CardContent>
      </Card>
    </main>
  );
}
