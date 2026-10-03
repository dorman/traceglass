// @polsia:user-owned
//
// POST /api/waitlist — REST route handler that writes a WaitlistEntry and
// notifies the company owner.
// Lives under /api, which proxy.ts's matcher excludes (no CSP/nonce, not proxied).
//
// The POST is intentionally PUBLIC — anyone can join the waitlist.
// Do NOT add a public GET that lists signups here: the emails are PII. To let the
// founder VIEW signups, gate that view/route behind the auth module's role
// (install better-auth + use requireAdmin) — never list signups on a public route
// or page. (Only expose them publicly if the founder EXPLICITLY asks for one.)

import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { recordSubmission } from '@/lib/email/submissions';
import { notificationEmail } from '@/lib/email/templates';
import { env } from '@/lib/env';
import { waitlistSchema } from '@/lib/waitlist/schema';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = waitlistSchema.safeParse({ email: body.email, consent: body.consent });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const field of ['email', 'consent'] as const) {
      const message = fieldErrors[field]?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    const entry = await prisma.waitlistEntry.create({ data: { email: result.data.email } });

    let recorded = false;
    try {
      const submission = await recordSubmission({
        source: 'waitlist',
        email: result.data.email,
        idempotencyKey: entry.id,
      });
      recorded = submission.recorded;
    } catch {
      // Fall back to email when dashboard intake is unavailable. The saved row remains authoritative.
    }

    if (!recorded && env.POLSIA_COMPANY_EMAIL) {
      try {
        await sendEmail({
          to: env.POLSIA_COMPANY_EMAIL,
          ...notificationEmail({
            subject: 'New TraceGlass waitlist signup',
            title: 'New TraceGlass waitlist signup',
            lines: [`${result.data.email} requested a TraceGlass paid-plan email update.`],
          }),
        });
      } catch {
        // Notification is best-effort; the signup row has already been saved.
      }
    }
  } catch (err: unknown) {
    const isUniqueViolation = err instanceof Error && err.message.includes('Unique constraint');
    if (isUniqueViolation) {
      return NextResponse.json(
        { errors: { email: "You're already on the waitlist." } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { errors: { email: 'Something went wrong. Please try again.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
