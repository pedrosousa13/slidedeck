import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const stories = [
  'deck--default',
  'deck--peek',
  'deck--starting-index',
  'deck--controlled',
  'deck--pages',
  'deck--drag',
  'deck--click-to-focus',
  'deck--vertical',
  'deck--right-to-left'
];

for (const id of stories) {
  test(`the ${id} story passes axe`, async ({ page }) => {
    await page.goto(`/iframe.html?id=${id}&viewMode=story`);
    const deck = page.getByRole('region', { name: 'Featured slides' });
    await expect(deck).toBeVisible();
    await expect(
      deck.getByRole('group', { name: /^1 of \d+$/ })
    ).toBeAttached();

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

test('a controlled deck follows the index its parent sets', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--controlled&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });

  await page
    .getByRole('group', { name: 'Go to slide' })
    .getByRole('button', { name: '4' })
    .click();

  await expect(deck.getByRole('group', { name: '4 of 6' })).toBeInViewport({
    ratio: 1
  });
  await expect(deck).toHaveAttribute('data-index', '3');
});

test('a dot moves the deck to its page and the counter follows', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--default&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const dots = deck.getByRole('group', { name: 'Choose page' });
  await expect(deck.getByText('1 / 6')).toBeVisible();

  await dots.getByRole('button', { name: 'Go to page 3' }).click();

  await expect(deck.getByRole('group', { name: '3 of 6' })).toBeInViewport({
    ratio: 1
  });
  await expect(
    dots.getByRole('button', { name: 'Go to page 3' })
  ).toHaveAttribute('aria-current', 'true');
  await expect(deck.getByText('3 / 6')).toBeVisible();
});

test('a paged deck steps a page at a time, its page size set per breakpoint', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--pages&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  await expect(deck.getByText('1 / 4')).toBeVisible();

  await deck.getByRole('button', { name: 'Next' }).click();

  await expect(deck.getByRole('group', { name: '4 of 10' })).toBeInViewport({
    ratio: 1
  });
  await expect(deck.getByText('2 / 4')).toBeVisible();

  // Below the breakpoint, one slide per page.
  await page.setViewportSize({ width: 400, height: 720 });
  await expect(deck.getByText(/ \/ 10$/)).toBeVisible();
});

test('a mouse drag moves the deck and settles on a slide, without following a link', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--drag&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const link = deck.getByRole('link', { name: 'Article 1' });
  const box = (await link.boundingBox())!;
  const y = box.y + box.height / 2;

  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, y, { steps: 12 });
  await page.mouse.up();

  await expect(deck.getByRole('group', { name: '2 of 6' })).toBeInViewport({
    ratio: 1
  });
  await expect(deck).toHaveAttribute('data-index', '1');
  expect(new URL(page.url()).hash).toBe('');
});

test('a plain click on a link in a slide still follows it', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--drag&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });

  await deck.getByRole('link', { name: 'Article 1' }).click();

  await expect(page).toHaveURL(/#article-1$/);
  await expect(deck).toHaveAttribute('data-index', '0');
});

test('with drag off, a mouse drag leaves the deck where it is', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--drag&viewMode=story&args=drag:!false');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const link = deck.getByRole('link', { name: 'Article 1' });
  const box = (await link.boundingBox())!;
  const y = box.y + box.height / 2;

  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, y, { steps: 12 });
  await page.mouse.up();

  await page.waitForTimeout(500);
  await expect(deck.getByRole('group', { name: '1 of 6' })).toBeInViewport({
    ratio: 1
  });
  await expect(deck).toHaveAttribute('data-index', '0');
});

test('the focal slide is at the snap alignment point, and clicking a slide in view brings it there', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--click-to-focus&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const slide = (n: number) => deck.getByRole('group', { name: `${n} of 6` });
  // At the first snap point, slide 2 is nearer the centre than slide 1.
  await expect(slide(2)).toHaveAttribute('data-focal');
  await expect(deck).toHaveAttribute('data-index', '0');

  // Slide 3 is only partly in view: click its leading edge.
  await slide(3).click({ position: { x: 10, y: 10 } });

  await expect(slide(3)).toHaveAttribute('data-focal');
  await expect(slide(2)).not.toHaveAttribute('data-focal');
  await expect(deck).toHaveAttribute('data-index', '2');
});

test('a vertical deck steps down with Next and snaps back after a short scroll', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--vertical&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const viewport = deck.locator('[data-slidedeck-viewport]');
  const top = async (n: number) =>
    (await deck.getByRole('group', { name: `${n} of 6` }).boundingBox())!.y -
    (await viewport.boundingBox())!.y;

  await deck.getByRole('button', { name: 'Next' }).click();

  await expect(deck).toHaveAttribute('data-index', '1');
  await expect.poll(() => top(2)).toBe(0);

  // A short wheel scroll down comes back to rest on the same slide.
  const box = (await viewport.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 40);
  await expect.poll(() => top(2)).toBe(0);
  await expect(deck).toHaveAttribute('data-index', '1');
});

test('in a right-to-left document, Next moves toward the inline end', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--right-to-left&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const viewport = (await deck
    .locator('[data-slidedeck-viewport]')
    .boundingBox())!;
  const slide = (n: number) => deck.getByRole('group', { name: `${n} of 6` });
  // The first slide sits at the right, the inline start.
  const first = (await slide(1).boundingBox())!;
  expect(first.x + first.width).toBeCloseTo(viewport.x + viewport.width, 0);

  await deck.getByRole('button', { name: 'Next' }).click();

  await expect(deck).toHaveAttribute('data-index', '1');
  await expect(slide(2)).toBeInViewport({ ratio: 1 });
  // The first slide has moved off to the right.
  await expect
    .poll(async () => (await slide(1).boundingBox())!.x)
    .toBeGreaterThanOrEqual(viewport.x + viewport.width - 1);
});
