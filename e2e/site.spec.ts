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

const SCHEMES = ['light', 'dark'] as const;

for (const scheme of SCHEMES) {
  test.describe(`in the ${scheme} scheme`, () => {
    test.use({ colorScheme: scheme });

    test('the site placeholder page passes axe', async ({ page }) => {
      await openHydrated(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  });
}

// Contrast is axe's to check; this only checks that the scheme switches.
test('the ground and the text follow the color scheme', async ({ browser }) => {
  const colours = [];
  for (const colorScheme of SCHEMES) {
    const page = await browser.newPage({ colorScheme });
    await page.goto(process.env.SITE_URL ?? 'http://127.0.0.1:4174');
    colours.push(
      await page.locator('body').evaluate((body) => {
        const style = getComputedStyle(body);
        return { ground: style.backgroundColor, text: style.color };
      })
    );
    await page.close();
  }
  const [light, dark] = colours;
  expect(dark!.ground).not.toBe(light!.ground);
  expect(dark!.text).not.toBe(light!.text);
});

test('the page sets a viewport and both color schemes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    'width=device-width, initial-scale=1'
  );
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light dark');
});

test('the nav bar links the site', async ({ page }) => {
  await page.goto('/');
  const banner = page.getByRole('banner');
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

/**
 * Checks the page does not scroll sideways and every nav link lies within
 * the viewport's width.
 */
async function expectNoSidewaysScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(scroll).toBe(client);
  for (const link of await page.getByRole('banner').getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(client);
  }
}

test.describe('at 320px wide', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the page does not scroll sideways and the nav fits', async ({
    page
  }) => {
    await openHydrated(page);
    await expectNoSidewaysScroll(page);
  });

  // The system stack falls back to whatever a machine has: CI's Linux
  // runner draws it wider than SF or Helvetica. DejaVu Sans where it is
  // installed, and letter-spacing everywhere, so the text is wide on any
  // machine.
  test('a wide fallback font does not make the page scroll sideways', async ({
    page
  }) => {
    await openHydrated(page);
    await page.addStyleTag({
      content:
        "* { font-family: 'DejaVu Sans', Verdana, sans-serif !important; letter-spacing: 0.08em !important; }"
    });
    await expectNoSidewaysScroll(page);
  });
});

test('the current dot stretches', async ({ page }) => {
  await openHydrated(page);
  const dots = page.locator('[data-slidedeck-dots] [data-index]');
  const current = await dots
    .and(page.locator('[aria-current="true"]'))
    .boundingBox();
  const other = await dots
    .and(page.locator(':not([aria-current="true"])'))
    .first()
    .boundingBox();
  expect(current!.width).toBeGreaterThan(other!.width * 2);
});

// WCAG 2.5.8: a target of 24 by 24 CSS pixels at least.
test('every dot is a target of 24 by 24 at least', async ({ page }) => {
  await openHydrated(page);
  const dots = page.locator('[data-slidedeck-dots] [data-index]');
  await expect(dots).toHaveCount(3);
  for (const dot of await dots.all()) {
    const box = await dot.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  }
});

test('the autoplay toggle is 44 by 44 at least', async ({ page }) => {
  await openHydrated(page);
  const box = await page
    .locator('[data-slidedeck-autoplay-toggle]')
    .boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

for (const width of [1280, 375]) {
  test.describe(`at ${String(width)}px wide`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('the controls sit in one row under the slides, toggle first', async ({
      page
    }) => {
      await expectControlsRow(page);
    });
  });
}

async function expectControlsRow(page: Page) {
  await openHydrated(page);
  const viewport = (await page
    .locator('[data-slidedeck-viewport]')
    .boundingBox())!;
  const row = [];
  for (const selector of [
    '[data-slidedeck-autoplay-toggle]',
    '[data-slidedeck-prev]',
    '[data-slidedeck-next]',
    '[data-slidedeck-dots]'
  ]) {
    row.push((await page.locator(selector).boundingBox())!);
  }
  for (const [i, box] of row.entries()) {
    expect(box.y).toBeGreaterThanOrEqual(viewport.y + viewport.height);
    expect(
      Math.abs(box.y + box.height / 2 - (row[0]!.y + row[0]!.height / 2))
    ).toBeLessThan(1);
    // Left to right, in this order, with a gap between each pair.
    if (i > 0) {
      const before = row[i - 1]!;
      expect(box.x).toBeGreaterThan(before.x + before.width);
    }
  }
  // Centred under the slides.
  const left = row[0]!.x - viewport.x;
  const last = row.at(-1)!;
  const right = viewport.x + viewport.width - (last.x + last.width);
  expect(Math.abs(left - right)).toBeLessThan(2);
}

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
