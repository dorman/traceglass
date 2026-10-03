import { describe, expect, it } from 'vitest';
import { passwordResetEmail } from '@/lib/email/templates';

describe('password reset email template', () => {
  it('escapes the supplied reset URL in the button href and supplies plain text', () => {
    const resetUrl = 'https://traceglass.example/reset-password/token?next="<safe>&again=1';
    const email = passwordResetEmail({ resetUrl });

    expect(email.subject).toBe('Reset your TraceGlass password');
    expect(email.html).toContain('href="https://traceglass.example/reset-password/token?next=&quot;&lt;safe&gt;&amp;again=1"');
    expect(email.html).not.toContain('next="<safe>&again=1');
    expect(email.text).toContain(`Reset password: ${resetUrl}`);
    expect(email.text).toContain('This link expires in one hour and can be used once.');
    expect(email.text).not.toContain('password: undefined');
  });
});
