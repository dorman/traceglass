// @polsia:user-owned
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestPasswordReset } from '@/lib/auth-recovery-client';

const genericConfirmation =
  'If the address is registered, check its inbox for a password reset link.';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSubmitted(false);
    setError(false);
    try {
      const result = await requestPasswordReset({ email, redirectTo: '/reset-password' });
      if (result.error) {
        setError(true);
        return;
      }
      setSubmitted(true);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <Label htmlFor="recovery-email">Email address</Label>
        <Input
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          aria-invalid={error || undefined}
        />
        {submitted ? (
          <output className="text-sm text-muted-foreground">{genericConfirmation}</output>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            We could not process that request right now. Please try again shortly.
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Remembered your password?{' '}
        <Link
          href="/login"
          className="font-medium text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
      <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
        If you are unsure which email you used, check the inbox and spam folder for each address you
        control. If you are still uncertain, ask through a trusted support or operator channel to
        verify your identity.
      </p>
    </>
  );
}
