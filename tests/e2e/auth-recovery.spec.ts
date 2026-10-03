// @polsia:user-owned — Better Auth recovery, verification, and editor access journey.
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { SiteDesignResponse } from '../../src/lib/contracts/site-design';
import {
  baseURL,
  establishVerifiedOwner,
  recoveredOwnerFixturePassword,
  recoveryConfirmation,
  setOwnerVerifiedForTest,
  verifyOwnerThroughEmail,
} from './support/auth-fixture';
import {
  capturedEmailCount,
  clearCapturedEmails,
  emailLink,
  failNextCapturedDelivery,
  startCapturedEmailProxy,
  stopCapturedEmailProxy,
  waitForCapturedEmail,
} from './support/email-proxy';

function route(path: string) {
  return new URL(path, baseURL).toString();
}

async function expireResetToken(token: string) {
  const prisma = new PrismaClient();
  try {
    await prisma.verification.updateMany({
      where: { identifier: `reset-password:${token}` },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeAll(async () => {
  await startCapturedEmailProxy();
});

test.afterAll(async () => {
  await stopCapturedEmailProxy();
});

test('owner recovery stays private, verifies the owner gate, and revokes old sessions', async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(150_000);
  const ownerEmail = process.env.POLSIA_OWNER_EMAIL;
  test.skip(!ownerEmail, 'The browser harness did not provide the configured owner identity.');
  const owner = ownerEmail ?? '';
  const { password: priorPassword } = await establishVerifiedOwner(page, owner);

  const anonymousAdminResponse = await request.get(route('/api/admin/site-design'));
  expect(anonymousAdminResponse.status()).toBe(401);

  await setOwnerVerifiedForTest(owner, false);
  try {
    const access = await page.request.get(route('/api/admin/pages/access'));
    expect(await access.json()).toEqual({ isOwner: false });
    expect((await page.request.get(route('/api/admin/site-design'))).status()).toBe(403);
  } finally {
    await verifyOwnerThroughEmail(page, owner);
  }

  const initialResponse = await page.request.get(route('/api/admin/site-design'));
  expect(initialResponse.status()).toBe(200);
  const initial = SiteDesignResponse.parse(await initialResponse.json());
  const changed = {
    ...initial.design,
    colors: { ...initial.design.colors, primary: '#237A56' },
  };
  try {
    const saveResponse = await page.request.patch(route('/api/admin/site-design'), { data: changed });
    expect(saveResponse.status()).toBe(200);
    expect(SiteDesignResponse.parse(await saveResponse.json()).design).toEqual(changed);
  } finally {
    await page.request.patch(route('/api/admin/site-design'), { data: initial.design });
  }

  const nonOwnerContext = await browser.newContext();
  try {
    const nonOwnerPage = await nonOwnerContext.newPage();
    const nonOwnerEmail = `auth-recovery-${Date.now()}@example.test`;
    const nonOwnerPassword = `Synthetic-non-owner-${Date.now()}-Password!`;
    await nonOwnerPage.goto(route('/signup'));
    await nonOwnerPage.getByLabel('Name').fill('Synthetic non-owner test');
    await nonOwnerPage.getByLabel('Email address').fill(nonOwnerEmail);
    await nonOwnerPage.getByLabel('Password').fill(nonOwnerPassword);
    await nonOwnerPage.getByRole('button', { name: 'Create account' }).click();
    await expect(nonOwnerPage).toHaveURL(route('/'));
    expect((await nonOwnerPage.request.get(route('/api/admin/site-design'))).status()).toBe(403);
  } finally {
    await nonOwnerContext.close();
  }

  await page.goto(route('/forgot-password'));
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByLabel('Email address')).toBeVisible();
  await page.getByLabel('Email address').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  clearCapturedEmails();
  await page.getByLabel('Email address').fill(owner);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  const knownMessage = page.getByRole('status');
  await expect(knownMessage).toHaveText(recoveryConfirmation);
  const knownText = (await knownMessage.textContent())?.trim();
  const firstResetEmail = await waitForCapturedEmail('Reset your TraceGlass password');
  const firstResetLink = emailLink(firstResetEmail);
  const firstToken = firstResetLink.pathname.split('/').pop();
  expect(firstToken).toBeTruthy();

  clearCapturedEmails();
  const unknownEmail = `unknown-${Date.now()}@example.test`;
  await page.getByLabel('Email address').fill(unknownEmail);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  const unknownMessage = page.getByRole('status');
  await expect(unknownMessage).toHaveText(recoveryConfirmation);
  expect((await unknownMessage.textContent())?.trim()).toBe(knownText);
  expect(capturedEmailCount()).toBe(0);

  await page.waitForTimeout(61_000);

  clearCapturedEmails();
  failNextCapturedDelivery();
  await page.getByLabel('Email address').fill(owner);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toHaveText(recoveryConfirmation);
  expect(capturedEmailCount()).toBe(0);

  const secondContext = await browser.newContext();
  try {
    const secondPage = await secondContext.newPage();
    await secondPage.goto(route('/login'));
    await secondPage.getByLabel('Email address').fill(owner);
    await secondPage.getByLabel('Password').fill(priorPassword);
    await secondPage.getByRole('button', { name: 'Sign in' }).click();
    await expect(secondPage).toHaveURL(route('/'));

    clearCapturedEmails();
    await page.goto(route('/forgot-password'));
    await page.getByLabel('Email address').fill(owner);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toHaveText(recoveryConfirmation);
    const usableResetEmail = await waitForCapturedEmail('Reset your TraceGlass password');
    const usableResetLink = emailLink(usableResetEmail);
    const usableToken = usableResetLink.pathname.split('/').pop();
    expect(usableToken).toBeTruthy();

    await expireResetToken(firstToken ?? '');
    await page.goto(firstResetLink.toString());
    await expect(page).toHaveURL(/\/reset-password\?error=INVALID_TOKEN$/);
    await expect(page.locator('p[role="alert"]')).toContainText(
      'invalid, expired, or has already been used',
    );

    const newPassword = recoveredOwnerFixturePassword;
    await page.goto(usableResetLink.toString());
    await page.getByLabel('New password', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirm new password').fill(newPassword);
    await page.getByRole('button', { name: 'Set new password' }).click();
    await expect(page.getByRole('status')).toContainText('Your password has been reset.');
    expect((await secondPage.request.get(route('/api/admin/site-design'))).status()).toBe(401);

    await page.goto(route('/login'));
    await page.getByLabel('Email address').fill(owner);
    await page.getByLabel('Password').fill(priorPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('form p[role="alert"]')).toContainText('Could not sign in');
    await page.getByLabel('Password').fill(newPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(route('/'));
    expect((await page.request.get(route('/api/admin/site-design'))).status()).toBe(200);

    await page.goto(usableResetLink.toString());
    await expect(page).toHaveURL(/\/reset-password\?error=INVALID_TOKEN$/);
    await expect(page.locator('p[role="alert"]')).toContainText(
      'invalid, expired, or has already been used',
    );
  } finally {
    await secondContext.close();
  }

  await page.setViewportSize({ width: 1280, height: 800 });
});

test('sign-in exposes recovery and handles rejected requests without remaining pending', async ({
  page,
}) => {
  await page.goto(route('/login'));
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
    'href',
    '/forgot-password',
  );
  await page.getByLabel('Email address').fill('missing@example.test');
  await page.getByLabel('Password').fill('Synthetic-no-account-password');
  await page.route('**/api/auth/sign-in/email', async (routeHandler) => {
    await routeHandler.abort('failed');
  });
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('form p[role="alert"]')).toContainText('Could not sign in right now');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
});
