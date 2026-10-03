// @polsia:user-owned — configure better-auth here (spread into betterAuth() by @/lib/auth).
// Add emailAndPassword options, plugins, session, socialProviders, databaseHooks, etc.
// Framework owns db/secret/baseURL/admin() + the owner-admin grant (no-op if set here).
//
// Welcome email / signup side-effect (runs alongside the owner-admin grant — install `email`):
//   import { sendEmail } from '@/lib/email/send';
//   databaseHooks: { user: { create: { after: async (user) => {
//     await sendEmail({ to: user.email, subject: 'Welcome', html: '<p>Welcome!</p>' }).catch(() => {});
//   } } } },
// Add a plugin: `plugins: [organization()]` (admin() is added for you).
//
// Per-user fields (a `username`, profile, prefs): don't add a column to `User` (auth.prisma
// is locked) or use `user.additionalFields` (needs that locked column). Make a user-owned
// `prisma/schema/profile.prisma` (model UserProfile { userId String @unique /* fields */ },
// scalar userId) and create the row at signup:
//   import { prisma } from '@/lib/db';
//   databaseHooks: { user: { create: { after: async (user) => {
//     await prisma.userProfile.create({ data: { userId: user.id } }).catch(() => {});
//   } } } },

import type { BetterAuthOptions } from 'better-auth';
import { sendEmail } from '@/lib/email/send';
import { passwordResetEmail, verificationEmail } from '@/lib/email/templates';

export const authConfig: BetterAuthOptions = {
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const result = await sendEmail({
        to: user.email,
        ...verificationEmail({ name: user.name, verificationUrl: url }),
      });
      if (!result.id) throw new Error('Verification email could not be delivered');
    },
  },
  emailAndPassword: {
    enabled: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        const result = await sendEmail({
          to: user.email,
          ...passwordResetEmail({ resetUrl: url }),
        });
        if (!result.id) throw new Error('Reset email was not delivered');
      } catch {
        process.stderr.write('[auth-recovery] password reset email delivery failed\n');
      }
    },
  },
};
