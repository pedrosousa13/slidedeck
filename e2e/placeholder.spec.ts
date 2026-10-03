import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Proves the story -> Playwright -> axe pipe on the placeholder primitive. The
// tracer-bullet issue (#6) replaces the story and this spec with real ones.
test('the placeholder story renders Deck.Root with no axe violations', async ({
  page
}) => {
  await page.goto('/iframe.html?id=placeholder-root--default&viewMode=story');

  const root = page.locator('[data-slidedeck-root]');
  await expect(root).toBeVisible();

  // Axe's default rule set, scoped to the deck rather than Storybook's own
  // iframe chrome, which is not ours to fix.
  const results = await new AxeBuilder({ page })
    .include('[data-slidedeck-root]')
    .analyze();
  expect(results.violations).toEqual([]);
});
