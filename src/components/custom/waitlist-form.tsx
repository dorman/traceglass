// @polsia:user-owned
'use client';

import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';

// Composes the template's base shadcn primitives (Button/Input/Label) styled
// through the theme tokens. Restyle via the brand_tokens slot + cva variants,
// or pull more primitives with `npx shadcn add` and compose them.
export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; consent?: string }>({});
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    // apiFetch resolves on 2xx and throws on non-2xx with the parsed body on
    // `error.cause` — so the route's { errors: { email } } (400/409) is readable.
    try {
      await apiFetch('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email, consent }),
      });
      setOk(true);
      toast.success("You're on the list.");
    } catch (err) {
      const cause = (err as { cause?: { errors?: { email?: string; consent?: string } } }).cause;
      const fieldErrors = cause?.errors ?? {};
      const next: { email?: string; consent?: string } = {};
      if (fieldErrors.email) next.email = fieldErrors.email;
      if (fieldErrors.consent) next.consent = fieldErrors.consent;
      setErrors(next);
      if (!next.email && !next.consent) {
        toast.error('Something went wrong. Please try again.');
      }
    } finally {
      setPending(false);
    }
  }

  if (ok) {
    return (
      <output className="flex flex-col items-start gap-3 rounded-lg border border-brand-300/60 bg-brand-50/40 p-5 dark:border-brand-700/60 dark:bg-brand-900/30">
        <div className="flex items-center gap-2">
          <CheckCircle2 aria-hidden="true" className="size-5 text-brand-600 dark:text-brand-400" />
          <p className="text-base font-semibold text-foreground">You&apos;re on the list.</p>
        </div>
        <p className="text-sm text-muted-foreground">
          A paid TraceGlass plan is planned, but it isn&apos;t available yet. We&apos;ll send one
          email update; this signup did not start a subscription. Target launch date: November 15,
          2026. We only store your email address; no logs, source code, or filenames reach us.
        </p>
      </output>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="waitlist-email">Email address</Label>
        <Input
          id="waitlist-email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-invalid={errors.email ? true : undefined}
        />
        {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
      </div>

      <div className="grid gap-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="waitlist-consent"
            name="consent"
            checked={consent}
            onCheckedChange={(state) => setConsent(state === true)}
            aria-invalid={errors.consent ? true : undefined}
            className="mt-0.5"
          />
          <Label
            htmlFor="waitlist-consent"
            className="cursor-pointer text-sm font-normal leading-snug text-foreground"
          >
            I agree that TraceGlass may use my email to send one update about the planned paid plan,
            which is not available yet. Signing up does not start a subscription. My email is never
            sold.
          </Label>
        </div>
        {errors.consent ? <p className="text-sm text-destructive">{errors.consent}</p> : null}
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending request…' : 'Notify me when available'}
      </Button>
    </form>
  );
}
