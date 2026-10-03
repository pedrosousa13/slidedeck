import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const stories = ['deck--default', 'deck--peek', 'deck--starting-index'];

for (const id of stories) {
  test(`the ${id} story passes axe`, async ({ page }) => {
    await page.goto(`/iframe.html?id=${id}&viewMode=story`);
    const deck = page.getByRole('region', { name: 'Featured slides' });
    await expect(deck).toBeVisible();
    await expect(deck.getByRole('group', { name: '1 of 6' })).toBeAttached();

    // Axe's default rule set, scoped to the deck rather than Storybook's own
    // iframe chrome, which is not ours to fix.
    const results = await new AxeBuilder({ page })
      .include('[aria-roledescription="carousel"]')
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('tabbing into an off-screen slide scrolls it into view', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--default&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  await deck.getByRole('button', { name: 'Action 1' }).focus();

  await page.keyboard.press('Tab');

  await expect(deck.getByRole('button', { name: 'Action 2' })).toBeFocused();
  await expect(deck.getByRole('group', { name: '2 of 6' })).toBeInViewport({
    ratio: 1
  });
  await expect(deck).toHaveAttribute('data-index', '1');
});
