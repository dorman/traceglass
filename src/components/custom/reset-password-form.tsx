// @polsia:user-owned
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPassword } from '@/lib/auth-recovery-client';

export function ResetPasswordForm({
  token,
  invalidLink,
}: {
  token?: string;
  invalidLink: boolean;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [invalid, setInvalid] = useState(invalidLink || !token);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || invalid) return;
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setPending(true);
    setError(undefined);
    try {
      const result = await resetPassword({ newPassword: password, token });
      if (result.error) {
        if (result.error.code === 'INVALID_TOKEN') {
          setInvalid(true);
          return;
        }
        setError('We could not update your password. Please try again.');
        return;
      }
      setCompleted(true);
    } catch {
      setError('We could not update your password. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (completed) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <output className="text-sm text-muted-foreground">
          Your password has been reset. Sign in with your new password.
        </output>
        <Button asChild className="w-full">
          <Link href="/login">Return to sign in</Link>
        </Button>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p role="alert" className="text-sm text-destructive">
          This reset link is invalid, expired, or has already been used. Request a new link to
          continue.
        </p>
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new reset link</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <Label htmlFor="new-password">New password</Label>
      <Input
        id="new-password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        aria-invalid={error ? true : undefined}
      />
      <Label htmlFor="confirm-password">Confirm new password</Label>
      <Input
        id="confirm-password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        required
        aria-invalid={error ? true : undefined}
      />
      <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? 'Updating password…' : 'Set new password'}
      </Button>
    </form>
  );
}
