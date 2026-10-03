import { describe, expect, it } from 'vitest';
import { verificationEmail } from '@/lib/email/templates';

describe('verification email template', () => {
  it('explains verification and escapes the CTA URL while preserving it in plain text', () => {
    const verificationUrl = 'https://traceglass.example/verify?token=abc&callbackURL=%2Fprofile';
    const email = verificationEmail({ name: 'Ada', verificationUrl });

    expect(email.subject).toBe('Verify your TraceGlass account');
    expect(email.html).toContain('TraceGlass');
    expect(email.html).toContain('Hi Ada,');
    expect(email.html).toContain('Verify your email address to finish setting up your TraceGlass account.');
    expect(email.html).toContain('href="https://traceglass.example/verify?token=abc&amp;callbackURL=%2Fprofile"');
    expect(email.html).toContain('background:#158353');
    expect(email.html).toContain('>Verify your email</a>');
    expect(email.text).toContain('Verify your email address to finish setting up your TraceGlass account.');
    expect(email.text).toContain(`Verify your email: ${verificationUrl}`);
  });

  it('uses a generic greeting when the recipient has no name', () => {
    const email = verificationEmail({ verificationUrl: 'https://traceglass.example/verify?token=abc' });

    expect(email.html).toContain('Hello,');
    expect(email.text).toContain('Hello,');
    expect(email.html).not.toContain('Hi ,');
  });
});
