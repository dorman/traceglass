// @polsia:user-owned
import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/custom/forgot-password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Forgot password — TraceGlass',
  description: 'Request a secure password reset link for your TraceGlass account.',
};

export default function ForgotPasswordPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--background)] px-gutter py-section">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-[-30%] h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-[var(--brand-100)] opacity-40 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-[var(--brand-200)] opacity-30 blur-3xl" />
      </div>
      <Card className="relative w-full max-w-md border border-border/60 bg-card/95 shadow-brand backdrop-blur-sm">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="text-h4">Reset your password</CardTitle>
          <CardDescription>
            Enter the email address for your account and we’ll send a secure reset link.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
