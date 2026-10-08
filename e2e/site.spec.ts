import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The built site, apps/site, which playwright.config.ts serves on its own port.
// SITE_URL moves it, for a run beside another worktree's.
test.use({ baseURL: process.env.SITE_URL ?? 'http://127.0.0.1:4174' });

/**
 * Opens the placeholder page and waits until its deck has hydrated: the
 * engine marks a slide in view only once it runs in the browser.
 */
async function openHydrated(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() =>
    document.querySelector('[data-slidedeck-slide][data-in-view]')
  );
}

// The tokens of the approved direction, as computed colours: light is the
// product page, dark the keynote.
const SCHEMES = {
  light: { ground: 'rgb(255, 255, 255)', text: 'rgb(29, 29, 31)' },
  dark: { ground: 'rgb(0, 0, 0)', text: 'rgb(245, 245, 247)' }
} as const;

for (const [scheme, tokens] of Object.entries(SCHEMES)) {
  test.describe(`in the ${scheme} scheme`, () => {
    test.use({ colorScheme: scheme as keyof typeof SCHEMES });

    test('the site placeholder page passes axe', async ({ page }) => {
      await openHydrated(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });

    test("the page takes the scheme's ground and text", async ({ page }) => {
      await page.goto('/');
      const body = page.locator('body');
      await expect(body).toHaveCSS('background-color', tokens.ground);
      await expect(body).toHaveCSS('color', tokens.text);
    });
  });
}

test('the page sets a viewport and both color schemes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    'width=device-width, initial-scale=1'
  );
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light dark');
  await expect(page.locator('body')).toHaveCSS(
    'font-family',
    /^-apple-system, BlinkMacSystemFont/
  );
});

test('the nav bar is 48px high and links the site', async ({ page }) => {
  await page.goto('/');
  const banner = page.getByRole('banner');
  expect((await banner.boundingBox())?.height).toBe(48);
  await expect(banner.getByRole('link', { name: 'slidedeck' })).toBeVisible();
  const nav = banner.getByRole('navigation');
  await expect(nav.getByRole('link')).toHaveText([
    'Docs',
    'Examples',
    'GitHub',
    'Install'
  ]);
});

test('the footer names the license and the stack', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('contentinfo')).toHaveText(
    /MIT licensed\.\s*Built with pagedeck\. Served by Cloudflare\./
  );
});

test('the layout is outside every island, so it ships no JavaScript', async ({
  page
}) => {
  await page.goto('/');
  await expect(page.locator('header, footer')).toHaveCount(2);
  await expect(
    page.locator('fw-island header, fw-island footer, fw-island nav')
  ).toHaveCount(0);
});

test.describe('at 320px wide', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the page does not scroll sideways and the nav fits', async ({
    page
  }) => {
    await openHydrated(page);
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth
    }));
    expect(scroll).toBe(client);
    for (const link of await page.getByRole('banner').getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    }
  });
});

test('the dots are a pill whose current dot stretches', async ({ page }) => {
  await openHydrated(page);
  const dots = page.locator('[data-slidedeck-dots]');
  await expect(dots).toHaveCSS('border-radius', '999px');
  const current = dots.locator('button[aria-current="true"]');
  const other = dots.locator('button:not([aria-current="true"])').first();
  await expect(current).toHaveCSS('height', '44px');
  expect((await current.boundingBox())!.width).toBeGreaterThan(
    (await other.boundingBox())!.width * 2
  );
});

test('the autoplay toggle is a 44px round button', async ({ page }) => {
  await openHydrated(page);
  const toggle = page.locator('[data-slidedeck-autoplay-toggle]');
  await expect(toggle).toHaveCSS('width', '44px');
  await expect(toggle).toHaveCSS('height', '44px');
  await expect(toggle).toHaveCSS('border-radius', '999px');
});

test('the site placeholder deck moves on Next', async ({ page }) => {
  await openHydrated(page);
  const deck = page.getByRole('region', { name: 'Placeholder slides' });
  await expect(deck.getByRole('group', { name: '1 of 3' })).toHaveAttribute(
    'data-focal'
  );

  await deck.getByRole('button', { name: 'Next', exact: true }).click();

  await expect(deck.getByRole('group', { name: '2 of 3' })).toHaveAttribute(
    'data-focal'
  );
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the site placeholder deck renders its slides as HTML', async ({
    page
  }) => {
    await page.goto('/');
    const deck = page.getByRole('region', { name: 'Placeholder slides' });
    await expect(deck.getByRole('group', { name: / of 3$/ })).toHaveText([
      /Slide 1/,
      /Slide 2/,
      /Slide 3/
    ]);
  });
});
