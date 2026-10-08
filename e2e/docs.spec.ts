import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The site's docs, under /docs/, built from apps/site/docs. The site is served
// as in e2e/site.spec.ts; SITE_URL moves it.
test.use({ baseURL: process.env.SITE_URL ?? 'http://127.0.0.1:4174' });

// Every page the README's sections moved to.
const mapping = JSON.parse(
  readFileSync(new URL('../apps/site/readme-sections.json', import.meta.url), {
    encoding: 'utf8'
  })
) as Record<string, string>;
const PAGES = [...new Set(Object.values(mapping))];

/** Opens `path` and waits until every deck on it has hydrated. */
async function openHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-slidedeck-viewport]')].every(
      (viewport) =>
        viewport.querySelector('[data-slidedeck-slide][data-in-view]') !== null
    )
  );
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`in the ${scheme} scheme`, () => {
    test.use({ colorScheme: scheme });

    for (const path of PAGES) {
      test(`${path} passes axe`, async ({ page }) => {
        await openHydrated(page, path);
        // Curve fades each slide with its distance from the focal one, by
        // design, so contrast is checked on a curve deck's focal slide
        // only, as e2e/deck.spec.ts does, and every other rule everywhere.
        expect(
          (
            await new AxeBuilder({ page })
              .disableRules(['color-contrast'])
              .analyze()
          ).violations
        ).toEqual([]);
        expect(
          (
            await new AxeBuilder({ page })
              .withRules(['color-contrast'])
              .exclude(
                '[data-slidedeck-effect="curve"] > [data-slidedeck-slide]:not([data-focal])'
              )
              .analyze()
          ).violations
        ).toEqual([]);
      });
    }
  });
}

test('the sidebar lists every docs page, grouped', async ({ page }) => {
  await page.goto('/docs/');
  const sidebar = page.getByRole('navigation', { name: 'Documentation' });
  await expect(sidebar.getByRole('heading')).toHaveText([
    'Getting started',
    'Guides',
    'Reference',
    'Recipes',
    'Compare'
  ]);
  const hrefs = await sidebar
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(hrefs).toEqual(expect.arrayContaining(PAGES));
  await expect(
    sidebar.getByRole('link', { name: 'Introduction' })
  ).toHaveAttribute('aria-current', 'page');
});

test('a page lists its sections and links the pages either side', async ({
  page
}) => {
  await page.goto('/docs/guides/the-index/');
  const toc = page.getByRole('navigation', { name: 'On this page' });
  await expect(toc.getByRole('link').first()).toHaveAttribute('href', /^#/);
  const pager = page.getByRole('navigation', { name: 'Previous and next' });
  await expect(pager.getByRole('link')).toHaveText([
    /Previous\s*Layout is CSS/,
    /Next\s*Focal slide/
  ]);
});

test('the nav bar links the docs', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('banner').getByRole('navigation');
  await expect(nav.getByRole('link', { name: 'Docs' })).toHaveAttribute(
    'href',
    '/docs/'
  );
  await expect(nav.getByRole('link', { name: 'Install' })).toHaveAttribute(
    'href',
    '/docs/install/'
  );
  await expect(nav.getByRole('link', { name: 'Examples' })).toHaveAttribute(
    'href',
    '/docs/recipes/'
  );
});

test('a page shows its live example in a framed block', async ({ page }) => {
  await openHydrated(page, '/docs/quickstart/');
  const example = page.getByRole('figure', { name: 'Example' });
  const deck = example.getByRole('region', { name: 'Featured products' });
  await expect(deck.getByRole('group', { name: '1 of 3' })).toHaveAttribute(
    'data-current'
  );
  await deck.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(deck.getByRole('group', { name: '2 of 3' })).toHaveAttribute(
    'data-current'
  );
});

// Every example on every page: its decks hydrate, and one with a Next button
// moves on it.
for (const path of PAGES) {
  test(`${path}'s examples work`, async ({ page }) => {
    await openHydrated(page, path);
    for (const deck of await page
      .getByRole('figure', { name: 'Example' })
      .locator('[aria-roledescription="carousel"]')
      .all()) {
      const next = deck.locator('[data-slidedeck-next]');
      if ((await next.count()) === 0 || (await next.isDisabled())) continue;
      const before = await deck.getAttribute('data-index');
      await next.click();
      await expect(deck).not.toHaveAttribute('data-index', before ?? '');
    }
  });
}

test('search finds a page by a word from its body', async ({ page }) => {
  await page.goto('/docs/');
  const search = page.getByRole('combobox', { name: 'Search the docs' });
  // Hydrated on idle: typing before then would be lost.
  await expect(async () => {
    await search.fill('');
    await search.fill('seam');
    await expect(page.getByRole('option', { name: 'Loop' })).toBeVisible({
      timeout: 1000
    });
  }).toPass();
  await page.getByRole('option', { name: 'Loop' }).click();
  await expect(page).toHaveURL(/\/docs\/guides\/loop\/$/);
});

test.describe('in the dark scheme', () => {
  test.use({ colorScheme: 'dark' });

  test('code takes the dark theme colours', async ({ page }) => {
    await page.goto('/docs/quickstart/');
    const token = page.locator('pre.shiki span[style*="--shiki-dark"]').first();
    const { color, dark } = await token.evaluate((span) => {
      const probe = document.createElement('span');
      probe.style.color =
        getComputedStyle(span).getPropertyValue('--shiki-dark');
      document.body.append(probe);
      const dark = getComputedStyle(probe).color;
      probe.remove();
      return { color: getComputedStyle(span).color, dark };
    });
    expect(color).toBe(dark);
  });
});

test.describe('at 390px wide', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the sidebar stacks above the content and never sticks', async ({
    page
  }) => {
    await page.goto('/docs/guides/loop/');
    const sidebar = page.getByRole('navigation', { name: 'Documentation' });
    const content = page.getByRole('heading', { level: 1 });
    const side = (await sidebar.boundingBox())!;
    const heading = (await content.boundingBox())!;
    expect(side.y + side.height).toBeLessThanOrEqual(heading.y);
    expect(
      await sidebar.evaluate((nav) => getComputedStyle(nav).position)
    ).toBe('static');
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth
    }));
    expect(scroll).toBe(client);
  });
});

test.describe('at 1440px wide', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the sidebar sits beside the content and never sticks', async ({
    page
  }) => {
    await page.goto('/docs/guides/loop/');
    const sidebar = page.getByRole('navigation', { name: 'Documentation' });
    const side = (await sidebar.boundingBox())!;
    const heading = (await page
      .getByRole('heading', { level: 1 })
      .boundingBox())!;
    expect(side.x + side.width).toBeLessThanOrEqual(heading.x);
    expect(
      await sidebar.evaluate((nav) => getComputedStyle(nav).position)
    ).toBe('static');
  });
});

// The nav bar is sticky, so a heading a link scrolls to must land below it.
for (const [width, height] of [
  [1440, 900],
  [390, 844]
] as const) {
  test.describe(`at ${String(width)}px wide`, () => {
    test.use({ viewport: { width, height } });

    test('a table of contents link lands its heading below the nav bar', async ({
      page
    }) => {
      await page.goto('/docs/guides/the-index/');
      const toc = page.getByRole('navigation', { name: 'On this page' });
      const link = toc.getByRole('link').first();
      const target = (await link.getAttribute('href'))!;
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${target}$`));
      const heading = page.locator(target);
      await expect
        .poll(async () => (await heading.boundingBox())!.y)
        .toBeLessThan(height / 2);
      const nav = (await page.getByRole('banner').boundingBox())!;
      const top = (await heading.boundingBox())!.y;
      expect(top).toBeGreaterThanOrEqual(nav.y + nav.height);
    });
  });
}
