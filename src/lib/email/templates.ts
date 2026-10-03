// @polsia:user-owned — your email templates. Edit, add, or delete freely.
// Each template returns { subject, html, text }; send it via the framework transport:
//   import { sendEmail } from '@/lib/email/send';
//   import { welcomeEmail } from '@/lib/email/templates';
//   await sendEmail({ to: user.email, ...welcomeEmail({ name: user.name }) });
// renderEmail() is a plain inline-styled shell — email clients drop <style>/<link>, so style inline.
// renderEmail() auto-escapes its heading/body/cta/footer, so pass RAW values (don't escapeHtml() them
// first — that double-escapes). escapeHtml() is only for when you hand-build an html string yourself.

/** Subject + rendered bodies — spread into sendEmail({ to, ... }). */
export interface EmailContent {
  subject: string;
  html: string;
  text?: string;
}

export interface RenderEmailOptions {
  heading: string;
  /** Body paragraphs (plain text; escaped for you). */
  body: string[];
  /** Optional call-to-action button. */
  cta?: { label: string; url: string };
  /** Optional footer line under the divider. */
  footer?: string;
  /** Optional wordmark and accent used by branded messages. */
  brand?: { name: string; accentColor: string };
}

/** Escape a value for safe interpolation into an HTML attribute or text node. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wrap content in a minimal, inline-styled email shell. Restyle to match the brand. */
export function renderEmail(options: RenderEmailOptions): { html: string; text: string } {
  const accentColor = options.brand?.accentColor;
  const safeAccentColor =
    accentColor && /^#[\da-f]{6}$/i.test(accentColor) ? accentColor : '#111111';
  const brand = options.brand
    ? `<p style="margin:0 0 24px;color:${safeAccentColor};font-size:16px;font-weight:700;letter-spacing:0.04em;">${escapeHtml(options.brand.name)}</p>`
    : '';
  const paragraphs = options.body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;color:#333333;font-size:15px;line-height:1.6;">${escapeHtml(line)}</p>`,
    )
    .join('');
  const buttonStyle = options.brand
    ? `display:inline-block;padding:12px 22px;border-radius:4px;background:${safeAccentColor};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;`
    : 'display:inline-block;padding:10px 20px;background:#111111;color:#ffffff;text-decoration:none;font-size:15px;';
  const button = options.cta
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(options.cta.url)}" style="${buttonStyle}">${escapeHtml(options.cta.label)}</a></p>`
    : '';
  const footer = options.footer
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;color:#999999;font-size:12px;">${escapeHtml(options.footer)}</div>`
    : '';
  const html = [
    '<div style="max-width:560px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;">',
    brand,
    `<h1 style="margin:0 0 16px;color:#111111;font-size:22px;">${escapeHtml(options.heading)}</h1>`,
    paragraphs,
    button,
    footer,
    '</div>',
  ].join('');
  const text = [
    options.heading,
    '',
    ...options.body,
    ...(options.cta ? ['', `${options.cta.label}: ${options.cta.url}`] : []),
    ...(options.footer ? ['', options.footer] : []),
  ].join('\n');
  return { html, text };
}

// ─── Example templates — edit / add / remove to fit the app ───

/** Welcome email for a new signup. */
export function welcomeEmail(input: { name: string; ctaUrl?: string }): EmailContent {
  const { html, text } = renderEmail({
    heading: `Welcome, ${input.name}!`,
    body: ["Thanks for signing up — we're glad you're here."],
    cta: input.ctaUrl ? { label: 'Get started', url: input.ctaUrl } : undefined,
    footer: 'You received this because you created an account.',
  });
  return { subject: 'Welcome aboard', html, text };
}

/** Generic notification email. */
export function notificationEmail(input: {
  subject: string;
  title: string;
  lines: string[];
  cta?: { label: string; url: string };
}): EmailContent {
  const { html, text } = renderEmail({ heading: input.title, body: input.lines, cta: input.cta });
  return { subject: input.subject, html, text };
}

/** TraceGlass password reset email. The renderer escapes the supplied URL in HTML. */
export function passwordResetEmail(input: { resetUrl: string }): EmailContent {
  const { html, text } = renderEmail({
    heading: 'Reset your TraceGlass password',
    body: [
      'We received a request to reset the password for your TraceGlass account.',
      'This link expires in one hour and can be used once.',
    ],
    cta: { label: 'Reset password', url: input.resetUrl },
    footer: 'If you did not request this, you can ignore this email.',
  });
  return { subject: 'Reset your TraceGlass password', html, text };
}

/** TraceGlass account verification email. The renderer escapes the supplied URL in HTML. */
export function verificationEmail(input: {
  name?: string | null;
  verificationUrl: string;
}): EmailContent {
  const name = input.name?.trim();
  const { html, text } = renderEmail({
    brand: { name: 'TraceGlass', accentColor: '#158353' },
    heading: 'Verify your TraceGlass account',
    body: [
      name ? `Hi ${name},` : 'Hello,',
      'Verify your email address to finish setting up your TraceGlass account.',
      'Use the button below to verify your account.',
    ],
    cta: { label: 'Verify your email', url: input.verificationUrl },
    footer: "If you didn't create a TraceGlass account, you can ignore this email.",
  });
  return { subject: 'Verify your TraceGlass account', html, text };
}
