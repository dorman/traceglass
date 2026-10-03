// @polsia:user-owned — disposable-database owner fixture using only the public auth flow.
import { PrismaClient } from '@prisma/client';
import { expect, type Page } from '@playwright/test';
import {
  clearCapturedEmails,
  emailLink,
  waitForCapturedEmail,
} from './email-proxy';

export const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
export const recoveryConfirmation =
  'If the address is registered, check its inbox for a password reset link.';
export const ownerFixturePassword = 'Synthetic-owner-test-password-84!';
export const recoveredOwnerFixturePassword = 'Synthetic-owner-recovered-password-96!';

function route(path: string) {
  return new URL(path, baseURL).toString();
}

async function ownerVerificationState(email: string) {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { emailVerified: true },
    });
    return user?.emailVerified;
  } finally {
    await prisma.$disconnect();
  }
}

async function tryOwnerSignIn(page: Page, email: string, password: string) {
  await page.goto(route('/login'));
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  try {
    await expect(page).toHaveURL(route('/'), { timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
}

export async function setOwnerVerifiedForTest(email: string, emailVerified: boolean) {
  const prisma = new PrismaClient();
  try {
    await prisma.user.update({
      where: { email: email.trim().toLowerCase() },
      data: { emailVerified },
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function verifyOwnerThroughEmail(page: Page, email: string) {
  clearCapturedEmails();
  const response = await page.request.post(route('/api/auth/send-verification-email'), {
    headers: { origin: baseURL },
    data: { email, callbackURL: '/login' },
  });
  expect(response.ok()).toBe(true);
  const verificationEmail = await waitForCapturedEmail('Verify your email');
  await page.goto(emailLink(verificationEmail).toString());
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  expect(await ownerVerificationState(email)).toBe(true);
}

export async function establishVerifiedOwner(page: Page, email: string) {
  let password: string;
  const existingOwner = await ownerVerificationState(email);
  if (existingOwner === undefined) {
    await page.goto(route('/signup'));
    await page.getByLabel('Name').fill('Synthetic TraceGlass owner test');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(ownerFixturePassword);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(route('/'));
    password = ownerFixturePassword;
  } else if (await tryOwnerSignIn(page, email, recoveredOwnerFixturePassword)) {
    password = recoveredOwnerFixturePassword;
  } else if (await tryOwnerSignIn(page, email, ownerFixturePassword)) {
    password = ownerFixturePassword;
  } else {
    await page.goto(route('/forgot-password'));
    await page.getByLabel('Email address').fill(email);
    clearCapturedEmails();
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toContainText(recoveryConfirmation);
    const resetEmail = await waitForCapturedEmail('Reset your TraceGlass password');
    await page.goto(emailLink(resetEmail).toString());
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await page.getByLabel('New password', { exact: true }).fill(ownerFixturePassword);
    await page.getByLabel('Confirm new password').fill(ownerFixturePassword);
    await page.getByRole('button', { name: 'Set new password' }).click();
    await expect(page.getByRole('status')).toContainText('Your password has been reset.');
    password = ownerFixturePassword;
    expect(await tryOwnerSignIn(page, email, password)).toBe(true);
  }

  if (!(await ownerVerificationState(email))) await verifyOwnerThroughEmail(page, email);
  const access = await page.request.get(route('/api/admin/pages/access'));
  expect(access.ok()).toBe(true);
  expect(await access.json()).toEqual({ isOwner: true });
  return { password };
}
