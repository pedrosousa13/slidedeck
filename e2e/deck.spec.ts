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
  'deck--right-to-left',
  'deck--progress',
  'deck--fade',
  'deck--curve',
  'deck--autoplay'
];

for (const id of stories) {
  test(`the ${id} story passes axe`, async ({ page }) => {
    await page.goto(`/iframe.html?id=${id}&viewMode=story`);
    const deck = page.getByRole('region', { name: 'Featured slides' });
    await expect(deck).toBeVisible();
    await expect(
      deck.getByRole('group', { name: /^1 of \d+$/ })
    ).toBeAttached();
    // A story's entry animation, mid-fade, would read as low contrast.
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((a) => a.finished))
    );

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

test('data-in-view marks the slides in view, and progress scales them', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--progress&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const slide = (n: number) => deck.getByRole('group', { name: `${n} of 6` });
  const expectInViewMatchesViewport = async () => {
    for (let n = 1; n <= 6; n++) {
      if (await slide(n).evaluate((el) => el.hasAttribute('data-in-view'))) {
        await expect(slide(n)).toBeInViewport();
      } else {
        await expect(slide(n)).not.toBeInViewport();
      }
    }
  };
  const scale = (n: number) =>
    slide(n).evaluate((el) => getComputedStyle(el).scale);
  // Centred, two and a half in view: slide 1 at the start of the range,
  // slide 2 nearest the centre, slide 3 in part.
  await expect(slide(3)).toHaveAttribute('data-in-view');
  await expect(slide(4)).not.toHaveAttribute('data-in-view');
  await expectInViewMatchesViewport();

  await deck.getByRole('button', { name: 'Next' }).click();
  await deck.getByRole('button', { name: 'Next' }).click();

  await expect(deck).toHaveAttribute('data-index', '2');
  await expect(slide(1)).not.toHaveAttribute('data-in-view');
  await expect(slide(4)).toHaveAttribute('data-in-view');
  await expectInViewMatchesViewport();
  await expect.poll(() => scale(3)).toBe('1');
  await expect.poll(() => scale(4)).toBe('0.8');
});

test('a fade deck crossfades in place on Next, settles with one slide shown, and drags on', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--fade&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const viewport = deck.locator('[data-slidedeck-viewport]');
  const slides = deck.locator('[data-slidedeck-slide]');
  const opacities = () =>
    slides.evaluateAll((all) =>
      all.map((slide) => Number(getComputedStyle(slide).opacity))
    );
  await expect.poll(opacities).toEqual([1, 0, 0, 0]);

  // Sample every frame while Next scrolls: the two slides are seen part
  // shown together, and every slide stays where the viewport is.
  const sampled = page.evaluate(
    () =>
      new Promise<{ mixed: boolean; moved: boolean }>((resolve) => {
        const viewport = document.querySelector('[data-slidedeck-viewport]')!;
        const all = [...viewport.querySelectorAll('[data-slidedeck-slide]')];
        let mixed = false;
        let moved = false;
        const start = performance.now();
        const sample = () => {
          const box = viewport.getBoundingClientRect();
          for (const slide of all) {
            const opacity = Number(getComputedStyle(slide).opacity);
            if (opacity > 0.05 && opacity < 0.95) mixed = true;
            const rect = slide.getBoundingClientRect();
            if (Math.abs(rect.left - box.left) > 1) moved = true;
          }
          if (performance.now() - start < 1500) requestAnimationFrame(sample);
          else resolve({ mixed, moved });
        };
        requestAnimationFrame(sample);
      })
  );
  await deck.getByRole('button', { name: 'Next' }).click();
  expect(await sampled).toEqual({ mixed: true, moved: false });

  await expect(deck).toHaveAttribute('data-index', '1');
  await expect.poll(opacities).toEqual([0, 1, 0, 0]);
  await expect(slides.nth(1)).toHaveAttribute('data-focal');
  // The viewport scrolled natively; the slide shown is still at its start.
  expect(await viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await expect(slides.nth(1)).toBeInViewport({ ratio: 1 });

  // A mouse drag moves the deck on and settles on the next slide.
  const box = (await viewport.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, y, { steps: 12 });
  await page.mouse.up();

  await expect(deck).toHaveAttribute('data-index', '2');
  await expect.poll(opacities).toEqual([0, 0, 1, 0]);
  await expect(deck.getByRole('button', { name: 'Action 3' })).toBeInViewport();
});

test('a curve deck fans its cards on an arc, settles upright on Next, and drags on with no page scrollbar', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--curve&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const viewport = deck.locator('[data-slidedeck-viewport]');
  const slides = deck.locator('[data-slidedeck-slide]');
  /** Each slide's card's rotation in whole degrees, clockwise. */
  const angles = () =>
    slides.evaluateAll((all) =>
      all.map((slide) => {
        const card = slide.firstElementChild!;
        const m = new DOMMatrix(getComputedStyle(card).transform);
        return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
      })
    );
  await expect.poll(angles).toEqual([0, 19, 42, 90, 90, 90]);

  await deck.getByRole('button', { name: 'Next' }).click();
  await expect(deck).toHaveAttribute('data-index', '1');
  await expect.poll(angles).toEqual([-19, 0, 19, 42, 90, 90]);
  await expect(slides.nth(1)).toHaveAttribute('data-focal');

  // Sample the page every frame while a mouse drag moves the deck on: its
  // size never changes and it never overflows, so no scrollbar can appear.
  const sampled = page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const html = document.documentElement;
        const seen = new Set<string>();
        const start = performance.now();
        const sample = () => {
          seen.add(
            [
              html.scrollWidth - html.clientWidth,
              html.scrollHeight - html.clientHeight,
              html.clientWidth,
              html.clientHeight
            ].join()
          );
          if (performance.now() - start < 1500) requestAnimationFrame(sample);
          else resolve([...seen]);
        };
        requestAnimationFrame(sample);
      })
  );
  const box = (await viewport.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2 + 60, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 70, y, { steps: 12 });
  // Held still before letting go, so the deck settles on the nearest slide
  // rather than flinging on.
  await page.waitForTimeout(200);
  await page.mouse.up();
  const frames = await sampled;
  expect(frames).toHaveLength(1);
  const [overX, overY] = frames[0].split(',').map(Number);
  expect(overX).toBeLessThanOrEqual(0);
  expect(overY).toBeLessThanOrEqual(0);

  await expect(deck).toHaveAttribute('data-index', '2');
  await expect.poll(angles).toEqual([-42, -19, 0, 19, 42, 90]);
});

test('an autoplay deck rotates quietly until its toggle stops it', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--autoplay&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const live = deck.locator('[aria-live]');
  await expect(live).toHaveAttribute('aria-live', 'off');

  await expect(deck).toHaveAttribute('data-index', '1', { timeout: 5000 });
  await expect(live).toHaveAttribute('aria-live', 'off');

  await deck.getByRole('button', { name: 'Stop slide rotation' }).click();
  // Off the deck, so the pointer pauses nothing.
  await page.mouse.move(0, 0);

  const toggle = deck.getByRole('button', { name: 'Start slide rotation' });
  await expect(toggle).toBeVisible();
  await expect(live).toHaveAttribute('aria-live', 'polite');
  await page.waitForTimeout(4000);
  await expect(deck).toHaveAttribute('data-index', '1');

  // A change the user makes is announced.
  await deck.getByRole('button', { name: 'Next' }).click();
  await expect(live).toHaveText('Slide 3 of 6');
});
