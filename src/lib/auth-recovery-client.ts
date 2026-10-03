// @polsia:user-owned — client-safe access to Better Auth's native recovery endpoints.
'use client';

import { createAuthClient } from 'better-auth/react';

const recoveryClient = createAuthClient();

export const { requestPasswordReset, resetPassword } = recoveryClient;
