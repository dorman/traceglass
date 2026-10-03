// @polsia:user-owned — real browser regression coverage for public and denied design journeys.
import { expect, test } from '@playwright/test';
import { PageDetail, PublicPage } from '../../src/lib/contracts/pages';
import { SiteDesignResponse } from '../../src/lib/contracts/site-design';
import { establishVerifiedOwner } from './support/auth-fixture';
import { startCapturedEmailProxy, stopCapturedEmailProxy } from './support/email-proxy';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const logoAssetHost = 'pub-629428d185ca4960a0a73c850d32294b.r2.dev';

test.beforeAll(async () => {
  await startCapturedEmailProxy();
});

test.afterAll(async () => {
  await stopCapturedEmailProxy();
});

test('the shared TraceGlass logo loads at desktop and mobile widths', async ({ page }) => {
  for (const path of ['/', '/install']) {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(new URL(path, baseURL).toString());

      const logo = page.locator('header.site-design-nav img[alt="TraceGlass"]').first();
      await expect(logo).toBeVisible();
      const imageSource = await logo.getAttribute('src');
      expect(imageSource).toContain(logoAssetHost);
      expect(imageSource).toContain('598467e0-a6a8-427c-911e-8f7fd831b9c0.png');
      await expect
        .poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
      await expect
        .poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalHeight))
        .toBeGreaterThan(0);
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
    }
  }
});

test('public pages apply the validated site appearance', async ({ page, request }) => {
  const response = await request.get(new URL('/api/site-design', baseURL).toString());
  expect(response.status()).toBe(200);
  const appearance = SiteDesignResponse.parse(await response.json());
  expect((await request.get(new URL('/api/pages/not-a-published-page', baseURL).toString())).status()).toBe(404);

  for (const path of ['/', '/install']) {
    await page.goto(new URL(path, baseURL).toString());
    await expect(page.locator('html')).toHaveAttribute('data-site-design', 'active');
    await expect.poll(async () =>
      page.locator('html').evaluate((element) =>
        getComputedStyle(element).getPropertyValue('--site-primary').trim().toUpperCase(),
      ),
    ).toBe(appearance.design.colors.primary.toUpperCase());
  }
});

test('the configured owner can preview and save appearance settings', async ({ page }) => {
  const ownerEmail = process.env.POLSIA_OWNER_EMAIL;
  test.skip(!ownerEmail, 'The browser harness did not provide the configured owner identity.');

  await establishVerifiedOwner(page, ownerEmail ?? '');

  const adminUrl = new URL('/api/admin/site-design', baseURL).toString();
  const publicUrl = new URL('/api/site-design', baseURL).toString();
  const initial = SiteDesignResponse.parse(await (await page.request.get(adminUrl)).json());
  const invalidDesignResponse = await page.request.patch(adminUrl, {
    data: {
      ...initial.design,
      colors: { ...initial.design.colors, primary: 'var(--unsafe)' },
    },
  });
  expect(invalidDesignResponse.status()).toBe(400);
  expect(SiteDesignResponse.parse(await (await page.request.get(adminUrl)).json()).design).toEqual(
    initial.design,
  );
  const changed = {
    ...initial.design,
    colors: { ...initial.design.colors, primary: '#AA22CC' },
    typography: { ...initial.design.typography, displayFont: 'system' as const },
    radius: 'rounded' as const,
    cardTreatment: 'outlined' as const,
    buttonTreatment: 'outlined' as const,
  };

  let createdPageId: string | null = null;
  try {
    await page.goto(new URL('/admin/pages', baseURL).toString());
    await expect(page.getByRole('heading', { name: 'Marketing pages' })).toBeVisible();
    await page.locator('main').getByRole('link', { name: 'Design site' }).click();
    await expect(page.getByRole('heading', { name: 'Website appearance' })).toBeVisible();
    await page.locator('#design-color-primary').evaluate((element) => {
      if (!(element instanceof HTMLInputElement)) throw new Error('Expected a color input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(element, '#aa22cc');
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.getByLabel('Display font').selectOption('system');
    await page.getByLabel('Corner radius').selectOption('rounded');
    await page.getByLabel('Card treatment').selectOption('outlined');
    await page.getByLabel('Button treatment').selectOption('outlined');

    await expect.poll(async () =>
      page.locator('.site-design-preview').evaluate((element) =>
        getComputedStyle(element).getPropertyValue('--site-primary').trim().toUpperCase(),
      ),
    ).toBe(changed.colors.primary);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByLabel('Display font')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.getByRole('button', { name: 'Save appearance' }).click();
    await expect(page.getByText('Website appearance saved')).toBeVisible();
    expect(SiteDesignResponse.parse(await (await page.request.get(publicUrl)).json()).design).toEqual(changed);

    for (const path of ['/', '/install']) {
      await page.goto(new URL(path, baseURL).toString());
      await expect(page.locator('html')).toHaveAttribute('data-site-design', 'active');
      await expect.poll(async () =>
        page.locator('html').evaluate((element) =>
          getComputedStyle(element).getPropertyValue('--site-primary').trim().toUpperCase(),
        ),
      ).toBe(changed.colors.primary);
    }

    const slug = `design-layout-${Date.now()}`;
    const createResponse = await page.request.post(new URL('/api/admin/pages', baseURL).toString(), {
      data: {
        title: 'Synthetic layout journey',
        slug,
        body: 'Synthetic page body for the website editor browser journey.',
        seoDescription: 'Synthetic browser test page for editable columns and drafts.',
        content: {
          version: 1,
          sections: [
            {
              id: 'fixture-hero',
              kind: 'hero',
              data: { eyebrow: 'Browser fixture', heading: 'Layout fixture', body: 'Synthetic hero copy.' },
              assets: [],
            },
            {
              id: 'fixture-features',
              kind: 'features',
              data: {
                eyebrow: 'Browser fixture',
                heading: 'Fixture features',
                body: 'Synthetic feature copy.',
                items: [
                  { title: 'First item', body: 'First synthetic item.' },
                  { title: 'Second item', body: 'Second synthetic item.' },
                  { title: 'Third item', body: 'Third synthetic item.' },
                ],
              },
              assets: [],
            },
          ],
          assets: [],
        },
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = PageDetail.parse(await createResponse.json());
    createdPageId = created.id;
    const pageItemUrl = new URL(`/api/admin/pages/${created.id}`, baseURL).toString();
    const invalidLayoutContent = {
      ...created.content,
      sections: created.content.sections.map((section) =>
        section.kind === 'features' ? { ...section, layout: 'four-columns' } : section,
      ),
    };
    const invalidLayoutResponse = await page.request.patch(pageItemUrl, {
      data: { content: invalidLayoutContent },
    });
    expect(invalidLayoutResponse.status()).toBe(400);
    const unchangedPage = PageDetail.parse(await (await page.request.get(pageItemUrl)).json());
    expect(unchangedPage.hasDraft).toBe(false);
    expect(unchangedPage.content).toEqual(created.content);
    expect((await page.request.patch(pageItemUrl, { data: { status: 'PUBLISHED' } })).status()).toBe(200);

    await page.goto(new URL(`/admin/pages/${created.id}`, baseURL).toString());
    await expect(page.getByRole('heading', { name: 'Edit page' })).toBeVisible();
    await page.getByLabel('Column layout').selectOption('two-columns');
    await page.getByLabel('Add a rendered section').selectOption('cta');
    await page.getByRole('button', { name: 'Add section' }).click();
    await expect(page.getByRole('button', { name: 'Remove cta section' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove cta section' }).click();
    await page.getByRole('button', { name: 'Move section up' }).nth(1).click();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();

    const draft = PageDetail.parse(await (await page.request.get(pageItemUrl)).json());
    expect(draft.hasDraft).toBe(true);
    expect(draft.title).toBe('Synthetic layout journey');
    expect(draft.body).toBe('Synthetic page body for the website editor browser journey.');
    expect(draft.content.sections.map((section) => section.id)).toEqual([
      'fixture-features',
      'fixture-hero',
    ]);
    expect(draft.content.sections[0]?.layout).toBe('two-columns');

    await page.getByRole('link', { name: 'Preview' }).click();
    await expect(page).toHaveURL(new URL(`/admin/pages/preview/${created.id}`, baseURL).toString());
    await expect(page.locator('[data-preview="true"]')).toBeVisible();
    const featureGrid = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Fixture features' }) })
      .locator('.grid')
      .last();
    const desktopColumns = () =>
      featureGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    await expect.poll(desktopColumns).toBe(2);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect.poll(desktopColumns).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goBack();
    await expect(page).toHaveURL(new URL(`/admin/pages/${created.id}`, baseURL).toString());
    await expect(page.getByLabel('Title')).toHaveValue('Synthetic layout journey');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect.poll(async () =>
      PageDetail.parse(await (await page.request.get(pageItemUrl)).json()).hasDraft,
    ).toBe(false);
    const published = PageDetail.parse(await (await page.request.get(pageItemUrl)).json());
    expect(published.hasDraft).toBe(false);
    expect(published.content.sections[0]?.layout).toBe('two-columns');
    expect(PublicPage.parse(await (await page.request.get(new URL(`/api/pages/${slug}`, baseURL).toString())).json()).content.sections.map((section) => section.id)).toEqual([
      'fixture-features',
      'fixture-hero',
    ]);

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(new URL(`/pages/${slug}`, baseURL).toString());
    await expect(page.getByRole('heading', { name: 'Fixture features' })).toBeVisible();
  } finally {
    if (createdPageId) {
      await page.request.delete(new URL(`/api/admin/pages/${createdPageId}`, baseURL).toString());
    }
    await page.request.patch(adminUrl, { data: initial.design });
  }
});

test('anonymous and signed-in non-owner visitors cannot read or change site design', async ({
  page,
  request,
}) => {
  const publicUrl = new URL('/api/site-design', baseURL).toString();
  const adminUrl = new URL('/api/admin/site-design', baseURL).toString();
  const initialResponse = await request.get(publicUrl);
  expect(initialResponse.status()).toBe(200);
  const initialDesign = SiteDesignResponse.parse(await initialResponse.json());

  expect((await request.get(adminUrl)).status()).toBe(401);
  expect((await request.patch(adminUrl, { data: initialDesign.design })).status()).toBe(401);

  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto(new URL('/signup', baseURL).toString());
  await page.getByLabel('Name').fill('Synthetic design editor test');
  await page.getByLabel('Email address').fill(`site-design-${uniqueId}@example.test`);
  await page.getByLabel('Password').fill(`Synthetic-${uniqueId}-Password!`);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(new URL('/', baseURL).toString());

  expect((await page.request.get(adminUrl)).status()).toBe(403);
  await page.goto(new URL('/admin/design', baseURL).toString());
  await expect(page.getByText('Owner access required', { exact: true })).toBeVisible();
  const attemptedChange = {
    ...initialDesign.design,
    colors: { ...initialDesign.design.colors, primary: '#AA22CC' },
  };
  expect((await page.request.patch(adminUrl, { data: attemptedChange })).status()).toBe(403);

  const finalResponse = await page.request.get(publicUrl);
  expect(finalResponse.status()).toBe(200);
  expect(SiteDesignResponse.parse(await finalResponse.json())).toEqual(initialDesign);
});
