// @polsia:user-owned — public TraceGlass marketing page regression journey.
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { PageContent, PublicPage } from '../../src/lib/contracts/pages';
import { baseURL } from './support/auth-fixture';
import {
  capturedEmailAttempts,
  capturedProxyEvents,
  capturedSubmissions,
  clearCapturedProxyEvents,
  failNextCapturedDelivery,
  setNextSubmissionOutcome,
  startCapturedEmailProxy,
  stopCapturedEmailProxy,
} from './support/email-proxy';

function route(path: string) {
  return new URL(path, baseURL).toString();
}

function proxyEventsForSignup(email: string) {
  return capturedProxyEvents().filter((event) =>
    event.kind === 'submission' ? event.email === email : event.body.includes(email),
  );
}

async function publicPageResponse(page: import('@playwright/test').Page, slug: string) {
  return page.waitForResponse((response) => {
    try {
      return new URL(response.url()).pathname === `/api/pages/${slug}`;
    } catch {
      return false;
    }
  });
}

test('public pages no longer publish the retired paid offer', async ({ page }) => {
  test.setTimeout(60_000);

  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 850 });
    const responsePromise = publicPageResponse(page, 'home');
    await page.goto(route('/'));
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const home = PublicPage.parse(await response.json());

    expect(home.title).toBe('TraceGlass');
    expect(home.content.sections.map((section) => section.id)).toEqual([
      'hero',
      'features',
      'use-cases',
      'workflow',
      'privacy',
      'faq',
    ]);
    await expect(page.getByRole('heading', { name: 'Grammarly, for logs.' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Read the signal. Ignore the noise.');
    await expect(page.locator('body')).not.toContainText('$12');
    await expect(page.locator('body')).not.toContainText('Subscribe via Stripe');
    await expect(page.locator('a[href="/#pricing"]')).toHaveCount(0);
    await expect(page.locator('a[href="/billing"]')).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }

  await page.setViewportSize({ width: 1280, height: 850 });
  const releaseResponsePromise = publicPageResponse(page, 'release');
  await page.goto(route('/release'));
  const releaseResponse = await releaseResponsePromise;
  expect(releaseResponse.status()).toBe(200);
  const release = PublicPage.parse(await releaseResponse.json());
  expect(release.content.sections.map((section) => section.id)).not.toContain('release-cta');
  expect(
    release.content.sections.some(
      (section) =>
        section.id === 'pricing' ||
        section.kind === 'pricing' ||
        section.id === 'billing-card' ||
        section.kind === 'billing-card',
    ),
  ).toBe(false);
  await expect(page.getByRole('link', { name: 'Notify me' })).toHaveAttribute('href', '/waitlist');
  await expect(page.locator('body')).not.toContainText('$12');
  await expect(page.locator('body')).not.toContainText('Subscribe via Stripe');
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 850 });
    if (width < 768) await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('link', { name: 'Notify me' })).toHaveAttribute(
      'href',
      '/waitlist',
    );
    await expect(page.locator('body')).not.toContainText(/\$\s*\d/);
    await expect(page.locator('body')).not.toContainText('Subscribe via Stripe');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }

  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 850 });
    const waitlistResponsePromise = publicPageResponse(page, 'waitlist');
    await page.goto(route('/waitlist'));
    const waitlistResponse = await waitlistResponsePromise;
    expect(waitlistResponse.status()).toBe(200);
    const waitlist = PublicPage.parse(await waitlistResponse.json());

    expect(JSON.stringify(waitlist)).toContain(
      'A paid TraceGlass plan is planned, but it isn’t available yet.',
    );
    expect(JSON.stringify(waitlist)).toContain('does not start a subscription');
    expect(JSON.stringify(waitlist)).toContain('November 15, 2026');
    expect(JSON.stringify(waitlist)).not.toMatch(/\$\s*\d/);
    await expect(page.locator('body')).toContainText(
      'A paid TraceGlass plan is planned, but it isn’t available yet.',
    );
    await expect(page.locator('body')).toContainText('does not start a subscription');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /A paid TraceGlass plan is planned, but it isn’t available yet\./,
    );
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notify me when available' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/\$\s*\d/);
    await expect(page.locator('body')).not.toContainText('Subscribe via Stripe');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }

  const billingPageResponse = await page.request.get(route('/billing'));
  const pricingPageResponse = await page.request.get(route('/pricing'));
  const billingApiResponse = await page.request.get(route('/api/pages/billing'));
  expect(billingPageResponse.status()).toBe(404);
  expect(pricingPageResponse.status()).toBe(404);
  expect(billingApiResponse.status()).toBe(404);
  const billingAliasResponse = await page.request.get(route('/pages/billing'));
  expect(billingAliasResponse.status()).toBe(200);
  await page.goto(route('/pages/billing'));
  await expect(page.getByText('Page not found', { exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('This page is unpublished or does not exist.');

  await page.goto(route('/billing/checkout/cancelled'));
  await expect(page.getByRole('link', { name: 'Notify me' })).toHaveAttribute('href', '/waitlist');
  await expect(page.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');

  const prisma = new PrismaClient();
  try {
    const home = await prisma.marketingPage.findFirst({
      where: { OR: [{ sourceKey: 'home' }, { sourcePath: '/' }] },
      select: { title: true, content: true },
    });
    const release = await prisma.marketingPage.findFirst({
      where: { OR: [{ sourceKey: 'release' }, { sourcePath: '/release' }] },
      select: { content: true },
    });
    const billingRows = await prisma.marketingPage.findMany({
      where: { OR: [{ slug: 'billing' }, { sourceKey: 'billing' }, { sourcePath: '/billing' }] },
      select: { status: true, publishedAt: true },
    });

    expect(home?.title).toBe('TraceGlass');
    expect(
      PageContent.parse(home?.content).sections.some(
        (section) =>
          section.id === 'pricing' ||
          section.kind === 'pricing' ||
          section.id === 'billing-card' ||
          section.kind === 'billing-card',
      ),
    ).toBe(false);
    expect(
      PageContent.parse(release?.content).sections.map((section) => section.id),
    ).not.toContain('release-cta');
    expect(
      PageContent.parse(release?.content).sections.some(
        (section) =>
          section.id === 'pricing' ||
          section.kind === 'pricing' ||
          section.id === 'billing-card' ||
          section.kind === 'billing-card',
      ),
    ).toBe(false);
    expect(billingRows.every((row) => row.status === 'DRAFT' && row.publishedAt === null)).toBe(
      true,
    );
  } finally {
    await prisma.$disconnect();
  }
});

test(
  'Notify Me validates, persists, and keeps dashboard/email notifications fail-open',
  async ({ page }) => {
  test.setTimeout(90_000);
  await startCapturedEmailProxy();
  clearCapturedProxyEvents();

  const prisma = new PrismaClient();
  const emails = Array.from({ length: 4 }, () => `notify-${randomUUID()}@example.test`);
  const [recordedEmail, notRecordedEmail, intakeFailureEmail, mailFailureEmail] = emails;
  if (!recordedEmail || !notRecordedEmail || !intakeFailureEmail || !mailFailureEmail) {
    throw new Error('Could not create synthetic waitlist addresses.');
  }

  async function submit(email: string, consent = true) {
    await page.goto(route('/waitlist'));
    await page.getByLabel('Email address').fill(email);
    if (consent) await page.getByRole('checkbox').check();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/waitlist',
    );
    await page.getByRole('button', { name: 'Notify me when available' }).click();
    return responsePromise;
  }

  try {
    await page.setViewportSize({ width: 375, height: 850 });
    await page.goto(route('/waitlist'));
    await page.getByLabel('Email address').fill('not-an-email');
    await page.getByRole('checkbox').check();
    let responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/waitlist',
    );
    await page.getByRole('button', { name: 'Notify me when available' }).click();
    expect((await responsePromise).status()).toBe(400);
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();

    await page.getByLabel('Email address').fill(recordedEmail);
    await page.getByRole('checkbox').uncheck();
    responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/waitlist',
    );
    await page.getByRole('button', { name: 'Notify me when available' }).click();
    expect((await responsePromise).status()).toBe(400);
    await expect(page.getByText('Please confirm you want launch updates.')).toBeVisible();

    responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/waitlist',
    );
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Notify me when available' }).click();
    expect((await responsePromise).status()).toBe(201);
    await expect(page.locator('output').getByText("You're on the list.", { exact: true })).toBeVisible();
    await expect(page.getByText('This signup did not start a subscription.')).toBeVisible();

    const recordedRow = await prisma.waitlistEntry.findUnique({ where: { email: recordedEmail } });
    expect(recordedRow).not.toBeNull();
    await expect
      .poll(() => capturedSubmissions().some((submission) => submission.email === recordedEmail))
      .toBe(true);
    const dashboardSubmission = capturedSubmissions().find(
      (submission) => submission.email === recordedEmail,
    );
    expect(dashboardSubmission).toMatchObject({
      source: 'waitlist',
      email: recordedEmail,
      idempotencyKey: recordedRow?.id,
      recorded: true,
      status: 200,
    });
    expect(capturedEmailAttempts().some((email) => email.text.includes(recordedEmail))).toBe(false);

    const eventsBeforeDuplicate = capturedProxyEvents().length;
    responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/waitlist',
    );
    await page.goto(route('/waitlist'));
    await page.getByLabel('Email address').fill(recordedEmail);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Notify me when available' }).click();
    expect((await responsePromise).status()).toBe(409);
    await expect(page.getByText("You're already on the waitlist.")).toBeVisible();
    expect(capturedProxyEvents()).toHaveLength(eventsBeforeDuplicate);

    setNextSubmissionOutcome('not-recorded');
    expect((await submit(notRecordedEmail)).status()).toBe(201);
    await expect
      .poll(() => capturedEmailAttempts().some((email) => email.text.includes(notRecordedEmail)))
      .toBe(true);
    const falseSubmissionEvents = proxyEventsForSignup(notRecordedEmail);
    expect(falseSubmissionEvents.map((event) => event.kind)).toEqual(['submission', 'email']);
    expect(capturedSubmissions().find((submission) => submission.email === notRecordedEmail)).toMatchObject({
      recorded: false,
      status: 200,
    });
    const fallbackEmail = capturedEmailAttempts().find((email) =>
      email.text.includes(notRecordedEmail),
    );
    expect(fallbackEmail?.to).toBe(process.env.POLSIA_COMPANY_EMAIL ?? 'traceglass@polsia.app');
    expect(await prisma.waitlistEntry.findUnique({ where: { email: notRecordedEmail } })).not.toBe(
      null,
    );

    setNextSubmissionOutcome('error');
    expect((await submit(intakeFailureEmail)).status()).toBe(201);
    await expect
      .poll(() => capturedEmailAttempts().some((email) => email.text.includes(intakeFailureEmail)))
      .toBe(true);
    expect(
      proxyEventsForSignup(intakeFailureEmail)
        .map(({ kind, status }) => [kind, status]),
    ).toEqual([
      ['submission', 503],
      ['email', 200],
    ]);
    expect(
      await prisma.waitlistEntry.findUnique({ where: { email: intakeFailureEmail } }),
    ).not.toBeNull();

    setNextSubmissionOutcome('not-recorded');
    failNextCapturedDelivery();
    expect((await submit(mailFailureEmail)).status()).toBe(201);
    await expect
      .poll(() =>
        proxyEventsForSignup(mailFailureEmail).some((event) => event.kind === 'email'),
      )
      .toBe(true);
    expect(
      proxyEventsForSignup(mailFailureEmail)
        .map(({ kind, status }) => [kind, status]),
    ).toEqual([
      ['submission', 200],
      ['email', 503],
    ]);
    await expect(page.locator('output').getByText("You're on the list.", { exact: true })).toBeVisible();
    expect(await prisma.waitlistEntry.findUnique({ where: { email: mailFailureEmail } })).not.toBe(
      null,
    );
  } finally {
    await prisma.waitlistEntry.deleteMany({ where: { email: { in: emails } } });
    expect(await prisma.waitlistEntry.count({ where: { email: { in: emails } } })).toBe(0);
    await prisma.$disconnect();
    await stopCapturedEmailProxy();
  }
  },
);
