// @polsia:user-owned — browser coverage for owner sign-in return and page access.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Locator } from '@playwright/test';
import {
  extractPlainText,
  pageBodyRichTextKey,
  richTextFieldKey,
} from '../../src/lib/business/marketing/rich-text';
import { PageContent, PageDetail, PageList } from '../../src/lib/contracts/pages';
import { baseURL, establishVerifiedOwner, setOwnerVerifiedForTest } from './support/auth-fixture';
import {
  clearCapturedEmails,
  emailLink,
  startCapturedEmailProxy,
  stopCapturedEmailProxy,
  waitForCapturedEmail,
} from './support/email-proxy';

test.beforeAll(async () => {
  await startCapturedEmailProxy();
});

test.afterAll(async () => {
  await stopCapturedEmailProxy();
});

function route(path: string) {
  return new URL(path, baseURL).toString();
}

async function expectNoPageForSlug(slug: string) {
  const prisma = new PrismaClient();
  try {
    expect(
      await prisma.marketingPage.findUnique({ where: { slug }, select: { id: true } }),
    ).toBeNull();
  } finally {
    await prisma.$disconnect();
  }
}

async function userEmailVerified(email: string) {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { emailVerified: true },
    });
    return user?.emailVerified === true;
  } finally {
    await prisma.$disconnect();
  }
}

async function typeAcrossEnter(editor: Locator, first: string, second: string, final: string) {
  await editor.fill(first);
  await editor.press('End');
  await editor.press('Enter');
  await expect(editor).toBeFocused();
  await editor.pressSequentially(second);
  await editor.press('Enter');
  await editor.press('Enter');
  await editor.pressSequentially(final);

  const visibleText = await editor.innerText();
  const firstIndex = visibleText.indexOf(first);
  const secondIndex = visibleText.indexOf(second);
  const finalIndex = visibleText.indexOf(final);
  expect(firstIndex).toBeGreaterThanOrEqual(0);
  expect(secondIndex).toBeGreaterThan(firstIndex);
  expect(finalIndex).toBeGreaterThan(secondIndex);
  expect(visibleText).toContain('\n');
  expect(visibleText).toContain('\n\n');
  await expect(editor).toBeFocused();

  const geometry = await editor.evaluate((element) => ({
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
}

async function appendAtMobileWidth(editor: Locator, line: string) {
  await editor.click();
  await editor.press('Control+End');
  await editor.press('Enter');
  await expect(editor).toBeFocused();
  await editor.pressSequentially(line);
  expect(await editor.innerText()).toContain(line);
  expect(await editor.innerText()).toContain('\n');
  expect(await editor.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}

function expectOrderedText(value: string, lines: readonly string[]) {
  let previousIndex = -1;
  for (const line of lines) {
    const index = value.indexOf(line);
    expect(index).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
  expect(value).toContain('\n');
  expect(value).toContain('\n\n');
}

function pageRichTextKeys(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
  const content = (value as Record<string, unknown>).content;
  if (typeof content !== 'object' || content === null || Array.isArray(content)) return [];
  const richText = (content as Record<string, unknown>).richText;
  if (typeof richText !== 'object' || richText === null || Array.isArray(richText)) return [];
  return Object.keys(richText);
}

async function expectPersistedEditorText(
  pageId: string,
  fallbackLines: readonly string[],
  sectionLines: readonly string[],
) {
  const prisma = new PrismaClient();
  try {
    const saved = await prisma.marketingPage.findUnique({
      where: { id: pageId },
      select: { body: true, content: true },
    });
    if (!saved) throw new Error('Expected the synthetic managed page to be persisted');

    const content = PageContent.parse(saved.content);
    const fallbackDocument = content.richText?.[pageBodyRichTextKey];
    const sectionDocument = content.richText?.[
      richTextFieldKey('synthetic-hero', ['data', 'body'])
    ];
    if (!fallbackDocument || !sectionDocument) {
      throw new Error(
        `Expected both rich-text documents to be persisted (fallback: ${Boolean(fallbackDocument)}, section: ${Boolean(sectionDocument)}, keys: ${Object.keys(content.richText ?? {}).join(', ') || 'none'})`,
      );
    }

    const fallbackText = extractPlainText(fallbackDocument);
    const sectionText = extractPlainText(sectionDocument);
    expectOrderedText(fallbackText, fallbackLines);
    expectOrderedText(sectionText, sectionLines);
    expect(saved.body).toBe(fallbackText);
    return { fallbackText, sectionText };
  } finally {
    await prisma.$disconnect();
  }
}

// better-auth throttles /sign-in/* endpoints at 3 requests per rolling 10
// seconds (keyed ip|path). The owner journeys below sign in more than three
// times in quick succession — establish attempts plus the wrong-then-correct
// password pair — so every sign-in-heavy phase first waits out the window (the
// same pattern as the 60s wait in auth-recovery.spec.ts). Blocked attempts
// never reach the server, so a page.route-aborted submit does not consume the
// budget.
const signInRateWindowMs = 10_500;

test('an owner returns to Manage Pages and preserves multiline page edits', async ({ page }) => {
  test.setTimeout(210_000);
  const ownerEmail = process.env.POLSIA_OWNER_EMAIL;
  test.skip(!ownerEmail, 'The browser harness did not provide the configured test owner identity.');

  await page.waitForTimeout(signInRateWindowMs);
  const { password } = await establishVerifiedOwner(page, ownerEmail ?? '');
  await page.waitForTimeout(signInRateWindowMs);
  await page.goto(route('/profile'));
  await page.getByRole('main').getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(route('/login'));

  const fixtureSlug = `manage-pages-access-${Date.now()}`;
  const fixtureTitle = 'Synthetic Manage Pages access fixture';
  let fixtureId: string | null = null;

  try {
    const anonymousCollection = await page.request.get(route('/api/admin/pages'));
    expect(anonymousCollection.status()).toBe(401);
    const anonymousCreate = await page.request.post(route('/api/admin/pages'), {
      data: {
        title: fixtureTitle,
        slug: fixtureSlug,
        body: 'Synthetic body used by the Manage Pages access journey.',
        seoDescription: 'Synthetic access test fixture.',
      },
    });
    expect(anonymousCreate.status()).toBe(401);
    expect((await page.request.get(route('/api/admin/pages/missing-page'))).status()).toBe(401);
    expect(
      (
        await page.request.patch(route('/api/admin/pages/missing-page'), {
          data: { title: 'Unauthorized change' },
        })
      ).status(),
    ).toBe(401);
    expect((await page.request.delete(route('/api/admin/pages/missing-page'))).status()).toBe(401);
    await expectNoPageForSlug(fixtureSlug);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(route('/admin/pages'));
    const accessCard = page.getByRole('main');
    await expect(accessCard.getByText('Owner access required', { exact: true })).toBeVisible();
    const signInLink = accessCard.getByRole('link', { name: 'Sign in', exact: true });
    await expect(signInLink).toHaveAttribute('href', '/login?returnTo=%2Fadmin%2Fpages');

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(signInLink).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
      true,
    );
    await signInLink.click();
    await expect(page).toHaveURL(route('/login?returnTo=%2Fadmin%2Fpages'));
    await expect(page.getByLabel('Email address')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
      true,
    );
    await page.getByLabel('Email address').fill(ownerEmail ?? '');
    await page.getByLabel('Password').fill('Wrong-synthetic-password-84!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'Could not sign in. Check your details and try again.',
    );
    await expect(page).toHaveURL(route('/login?returnTo=%2Fadmin%2Fpages'));

    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(route('/admin/pages'));
    await expect(page.getByRole('heading', { name: 'Marketing pages' })).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('header').getByRole('link', { name: 'Manage pages' })).toBeVisible();

    const createResponse = await page.request.post(route('/api/admin/pages'), {
      data: {
        title: fixtureTitle,
        slug: fixtureSlug,
        body: 'Synthetic body used by the Manage Pages access journey.',
        seoDescription: 'Synthetic access test fixture.',
        content: {
          version: 1,
          sections: [
            {
              id: 'synthetic-hero',
              kind: 'hero',
              data: {
                heading: 'Synthetic editor heading',
                body: 'Synthetic section body used by the editor regression.',
              },
              assets: [],
            },
          ],
          assets: [],
        },
      },
    });
    expect(createResponse.status()).toBe(201);
    const fixture = PageDetail.parse(await createResponse.json());
    fixtureId = fixture.id;

    const listResponse = await page.request.get(route('/api/admin/pages'));
    expect(PageList.parse(await listResponse.json()).items.some((item) => item.id === fixture.id)).toBe(
      true,
    );
    await page.goto(route('/admin/pages'));
    const fixtureArticle = page.getByRole('article').filter({ hasText: fixtureTitle });
    await expect(fixtureArticle).toBeVisible();
    await fixtureArticle.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit page' })).toBeVisible();
    await page.getByLabel('Title').fill('Synthetic Manage Pages edited fixture');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();

    const updated = PageDetail.parse(
      await (await page.request.get(route(`/api/admin/pages/${fixture.id}`))).json(),
    );
    expect(updated.title).toBe('Synthetic Manage Pages edited fixture');

    const richTextEditors = page.locator('[contenteditable="true"]');
    const fallbackEditor = richTextEditors.nth(0);
    const sectionBodyEditor = richTextEditors.nth(2);
    const desktopFallbackLines = [
      'Desktop fallback first line',
      'Desktop fallback second line',
      'Desktop fallback final line',
    ] as const;
    const desktopSectionLines = [
      'Desktop section first line',
      'Desktop section second line',
      'Desktop section final line',
    ] as const;

    await page.setViewportSize({ width: 1280, height: 800 });
    await typeAcrossEnter(fallbackEditor, ...desktopFallbackLines);
    await typeAcrossEnter(sectionBodyEditor, ...desktopSectionLines);

    const pageApi = route(`/api/admin/pages/${fixture.id}`);
    let attemptedRichTextKeys: string[] = [];
    await page.route(pageApi, async (routeHandler) => {
      if (routeHandler.request().method() !== 'PATCH') {
        await routeHandler.continue();
        return;
      }
      const requestBody = JSON.parse(routeHandler.request().postData() ?? '{}') as unknown;
      attemptedRichTextKeys = pageRichTextKeys(requestBody);
      await routeHandler.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Synthetic save failure' }),
      });
    });
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Could not save the draft')).toBeVisible();
    expect(attemptedRichTextKeys).toEqual(
      expect.arrayContaining([
        pageBodyRichTextKey,
        richTextFieldKey('synthetic-hero', ['data', 'body']),
      ]),
    );
    await expect(fallbackEditor).toContainText(desktopFallbackLines[0] ?? '');
    await expect(fallbackEditor).toContainText(desktopFallbackLines[2] ?? '');
    await expect(sectionBodyEditor).toContainText(desktopSectionLines[0] ?? '');
    await expect(sectionBodyEditor).toContainText(desktopSectionLines[2] ?? '');
    await page.unroute(pageApi);

    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();
    await expectPersistedEditorText(fixture.id, desktopFallbackLines, desktopSectionLines);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Edit page' })).toBeVisible();
    await expectOrderedText(await fallbackEditor.innerText(), desktopFallbackLines);
    await expectOrderedText(await sectionBodyEditor.innerText(), desktopSectionLines);

    await page.setViewportSize({ width: 375, height: 812 });
    const mobileFallbackLine = 'Mobile fallback continuation';
    const mobileSectionLine = 'Mobile section continuation';
    await appendAtMobileWidth(fallbackEditor, mobileFallbackLine);
    await appendAtMobileWidth(sectionBodyEditor, mobileSectionLine);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
      true,
    );

    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();
    const fallbackLines = [...desktopFallbackLines, mobileFallbackLine];
    const sectionLines = [...desktopSectionLines, mobileSectionLine];
    await expectPersistedEditorText(fixture.id, fallbackLines, sectionLines);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Edit page' })).toBeVisible();
    await expectOrderedText(await fallbackEditor.innerText(), fallbackLines);
    await expectOrderedText(await sectionBodyEditor.innerText(), sectionLines);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
      true,
    );
  } finally {
    if (fixtureId) await page.request.delete(route(`/api/admin/pages/${fixtureId}`));
  }
});

test('an unverified owner is offered the trusted verification step and regains access after verifying', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const ownerEmail = process.env.POLSIA_OWNER_EMAIL;
  test.skip(!ownerEmail, 'The browser harness did not provide the configured test owner identity.');

  await page.waitForTimeout(signInRateWindowMs);
  await establishVerifiedOwner(page, ownerEmail ?? '');
  await setOwnerVerifiedForTest(ownerEmail ?? '', false);

  const access = await page.request.get(route('/api/admin/pages/access'));
  expect(await access.json()).toEqual({ isOwner: false });
  expect((await page.request.get(route('/api/admin/pages'))).status()).toBe(403);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(route('/admin/pages'));
  const accessCard = page.getByRole('main');
  await expect(accessCard.getByText('Owner access required', { exact: true })).toBeVisible();
  await expect(accessCard.getByText('is not verified yet')).toBeVisible();
  await expect(
    accessCard.getByRole('button', { name: 'Resend verification email' }),
  ).toBeVisible();
  await expect(
    accessCard.getByText('This signed-in account does not have access to manage TraceGlass pages.'),
  ).toHaveCount(0);
  await expect(accessCard.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(0);

  await page.route('**/api/auth/send-verification-email', async (routeHandler) => {
    await routeHandler.abort('failed');
  });
  try {
    await accessCard.getByRole('button', { name: 'Resend verification email' }).click();
    await expect(accessCard.getByRole('alert')).toContainText(
      'We could not send the verification email',
    );
  } finally {
    await page.unroute('**/api/auth/send-verification-email');
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(accessCard.getByText('Owner access required', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 1280, height: 800 });

  clearCapturedEmails();
  await accessCard.getByRole('button', { name: 'Resend verification email' }).click();
  const verificationEmail = await waitForCapturedEmail('Verify your email');
  await page.goto(emailLink(verificationEmail).toString());
  await expect(page).toHaveURL(route('/admin/pages'));
  await expect(page.getByRole('heading', { name: 'Marketing pages' })).toBeVisible();

  const restoredAccess = await page.request.get(route('/api/admin/pages/access'));
  expect(await restoredAccess.json()).toEqual({ isOwner: true });
  expect((await page.request.get(route('/api/admin/pages'))).status()).toBe(200);
});

test('a verified signed-in non-owner sees denial and cannot read or mutate managed pages', async ({
  page,
}) => {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `manage-pages-non-owner-${uniqueId}@example.test`;
  const password = `Synthetic-${uniqueId}-Password!`;
  const fixtureSlug = `non-owner-pages-${uniqueId}`;

  clearCapturedEmails();
  await page.goto(route('/signup'));
  await page.getByLabel('Name').fill('Synthetic non-owner test');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(route('/'));

  // Complete the emailed verification so every denial below is pinned against a
  // VERIFIED non-owner — the strongest form of the owner-only restriction.
  const verificationEmail = await waitForCapturedEmail('Verify your email');
  await page.goto(emailLink(verificationEmail).toString());
  await expect.poll(async () => userEmailVerified(email)).toBe(true);

  const collectionRead = await page.request.get(route('/api/admin/pages'));
  expect(collectionRead.status()).toBe(403);
  const create = await page.request.post(route('/api/admin/pages'), {
    data: {
      title: 'Synthetic non-owner attempt',
      slug: fixtureSlug,
      body: 'This content must not be persisted.',
      seoDescription: 'Synthetic unauthorized write attempt.',
    },
  });
  expect(create.status()).toBe(403);
  expect((await page.request.get(route('/api/admin/pages/missing-page'))).status()).toBe(403);
  expect(
    (
      await page.request.patch(route('/api/admin/pages/missing-page'), {
        data: { title: 'Unauthorized change' },
      })
    ).status(),
  ).toBe(403);
  expect((await page.request.delete(route('/api/admin/pages/missing-page'))).status()).toBe(403);
  await expectNoPageForSlug(fixtureSlug);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(route('/admin/pages'));
  const accessCard = page.getByRole('main');
  await expect(accessCard.getByText('Owner access required', { exact: true })).toBeVisible();
  await expect(
    accessCard.getByText('This signed-in account does not have access to manage TraceGlass pages.'),
  ).toBeVisible();
  await expect(accessCard.getByText('is not verified yet')).toHaveCount(0);
  await expect(
    accessCard.getByRole('button', { name: 'Resend verification email' }),
  ).toHaveCount(0);
  await expect(accessCard.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(0);
  await expect(accessCard.getByRole('link', { name: 'New page' })).toHaveCount(0);
  await expect(page.locator('header').getByRole('link', { name: 'Manage pages' })).toHaveCount(0);

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(accessCard.getByText('Owner access required', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
