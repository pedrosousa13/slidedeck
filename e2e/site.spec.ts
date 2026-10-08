import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The built site, apps/site, which playwright.config.ts serves on its own port.
test.use({ baseURL: 'http://127.0.0.1:4174' });

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

test('the site placeholder page passes axe', async ({ page }) => {
  await openHydrated(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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
