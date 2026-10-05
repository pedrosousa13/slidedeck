import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Watches the deck's viewport for the next scroll to end. Await it before a
 * gesture, so the watch is in place; the function it returns resolves, once
 * that scroll ends, with how far the viewport got from where it was along
 * its axis at most, or 0 if no scroll ends within two seconds, so a gesture
 * that scrolls nothing fails rather than hangs.
 */
async function watchScroll(page: Page): Promise<() => Promise<number>> {
  const viewport = page.locator('[data-slidedeck-viewport]').first();
  await viewport.evaluate((el) => {
    const at = () => Math.abs(el.scrollLeft) + el.scrollTop;
    const start = at();
    let furthest = 0;
    const onScroll = () => {
      furthest = Math.max(furthest, Math.abs(at() - start));
    };
    (el as unknown as { ended: Promise<number> }).ended = new Promise(
      (resolve) => {
        const done = () => {
          el.removeEventListener('scroll', onScroll);
          clearTimeout(timer);
          resolve(furthest);
        };
        const timer = setTimeout(done, 2000);
        el.addEventListener('scroll', onScroll);
        el.addEventListener('scrollend', done, { once: true });
      }
    );
  });
  return () =>
    viewport.evaluate(
      (el) => (el as unknown as { ended: Promise<number> }).ended
    );
}

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
  'deck--autoplay',
  'deck--thumbnails',
  'deck--themed',
  'deck--loop',
  'deck--loop-pages',
  'deck--loop-vertical',
  'deck--loop-right-to-left',
  'deck--playdeck-video',
  'deck--playdeck-video-loop'
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
    const axe = () =>
      new AxeBuilder({ page }).include('[aria-roledescription="carousel"]');
    if (id !== 'deck--curve') {
      expect((await axe().analyze()).violations).toEqual([]);
      return;
    }
    // Curve fades each slide with its distance from the focal one, by
    // design, so the slides out of focus are low in contrast. Chromium's axe
    // cannot resolve the turned content's background there and leaves it
    // incomplete; Firefox's and WebKit's report it. So contrast is checked
    // on the focal slide and the controls, every other rule everywhere.
    expect(
      (await axe().disableRules(['color-contrast']).analyze()).violations
    ).toEqual([]);
    expect(
      (
        await axe()
          .withRules(['color-contrast'])
          .exclude('[data-slidedeck-slide]:not([data-focal])')
          .analyze()
      ).violations
    ).toEqual([]);
  });
}

/** A loop's copies, as opposed to its slides. */
const COPIES = '[data-slidedeck-copy]';

/**
 * Per slide of the playdeck recipe, whether its video is playing; a slide
 * whose player has not loaded yet has no video, and is not playing. The
 * slides by default; pass `COPIES` for a loop's copies instead.
 */
const videosPlaying = (
  page: Page,
  slides = '[data-slidedeck-slide]:not([data-slidedeck-copy])'
) =>
  page
    .getByRole('region', { name: 'Featured slides' })
    .locator(slides)
    .evaluateAll((slides) =>
      slides.map((slide) => {
        const video = slide.querySelector('video');
        return video !== null && !video.paused && video.currentTime > 0;
      })
    );

/**
 * Per slide, whether the looping playdeck story's recipe holds a player
 * handle for it; the story puts the recipe's players on `window`.
 */
const handlesHeld = (page: Page) =>
  page.evaluate(() =>
    Array.from(
      { length: 4 },
      (_, i) =>
        (window as unknown as { playdeckPlayers?: readonly unknown[] })
          .playdeckPlayers?.[i] != null
    )
  );

/** Whether the copy `selector` picks has a frame of its video to show. */
const copyHasFrame = (page: Page, selector: string) =>
  page
    .getByRole('region', { name: 'Featured slides' })
    .locator(selector)
    .evaluate((copy) => {
      const video = copy.querySelector('video');
      return (
        video !== null &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0
      );
    });

/** Resolves once the focal slide's video can play. */
const focalVideoLoaded = (page: Page) =>
  expect
    .poll(() =>
      page
        .locator('[data-slidedeck-slide][data-focal] video')
        .evaluateAll((videos: HTMLVideoElement[]) =>
          videos.some(
            (video) => video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
          )
        )
    )
    .toBe(true);

test("the playdeck recipe plays the focal slide's video and pauses the rest", async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--playdeck-video&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });

  await expect
    .poll(() => videosPlaying(page))
    .toEqual([true, false, false, false]);

  await deck.getByRole('button', { name: 'Next', exact: true }).click();

  await expect(deck.getByRole('group', { name: '2 of 4' })).toHaveAttribute(
    'data-focal'
  );
  await expect
    .poll(() => videosPlaying(page))
    .toEqual([false, true, false, false]);
});

test("the looping playdeck recipe plays the focal slide's video across the seam both ways", async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--playdeck-video-loop&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  /** Steps the deck, and checks the slide it rests on is focal, its video
   * the one playing, no copy's playing, and every slide's handle held. */
  const step = async (
    name: 'Previous' | 'Next',
    focal: string,
    playing: boolean[]
  ) => {
    await deck.getByRole('button', { name, exact: true }).click();
    await expect(deck.getByRole('group', { name: focal })).toHaveAttribute(
      'data-focal'
    );
    await expect.poll(() => videosPlaying(page)).toEqual(playing);
    expect(await videosPlaying(page, COPIES)).not.toContain(true);
    // The copies render again at each settle: no copy's ref replaces or
    // clears a slide's handle.
    expect(await handlesHeld(page)).toEqual([true, true, true, true]);
  };

  await expect
    .poll(() => videosPlaying(page))
    .toEqual([true, false, false, false]);
  expect(await videosPlaying(page, COPIES)).not.toContain(true);
  expect(await handlesHeld(page)).toEqual([true, true, true, true]);

  // Back across the seam: onto the copy of the last slide, then the jump.
  await step('Previous', '4 of 4', [false, false, false, true]);
  // The copies either side of the seam show a still frame, not a blank.
  await expect
    .poll(() =>
      copyHasFrame(page, '[data-slidedeck-copy=before][aria-label="4 of 4"]')
    )
    .toBe(true);
  await expect
    .poll(() =>
      copyHasFrame(page, '[data-slidedeck-copy=after][aria-label="1 of 4"]')
    )
    .toBe(true);
  // On across the seam, and one more.
  await step('Next', '1 of 4', [true, false, false, false]);
  await step('Next', '2 of 4', [false, true, false, false]);
});

test('under reduced motion the playdeck recipe plays no video by itself', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/iframe.html?id=deck--playdeck-video&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });

  await focalVideoLoaded(page);
  // Long enough for a play the recipe asked for to have started.
  await page.waitForTimeout(500);
  expect(await videosPlaying(page)).toEqual([false, false, false, false]);

  await deck.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(deck.getByRole('group', { name: '2 of 4' })).toHaveAttribute(
    'data-focal'
  );
  await focalVideoLoaded(page);
  await page.waitForTimeout(500);
  expect(await videosPlaying(page)).toEqual([false, false, false, false]);
});

test('turning on reduced motion pauses the playdeck recipe, and turning it off plays the focal video again', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--playdeck-video&viewMode=story');
  await expect
    .poll(() => videosPlaying(page))
    .toEqual([true, false, false, false]);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() => videosPlaying(page))
    .toEqual([false, false, false, false]);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect
    .poll(() => videosPlaying(page))
    .toEqual([true, false, false, false]);
});

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

test('clicking a thumbnail moves the main deck and marks the thumbnail', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--thumbnails&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const strip = page.getByRole('region', { name: 'Thumbnails' });

  await strip.getByRole('button', { name: 'Slide 3' }).click();

  await expect(deck.getByRole('group', { name: '3 of 8' })).toBeInViewport({
    ratio: 1
  });
  await expect(deck).toHaveAttribute('data-index', '2');
  await expect(strip.getByRole('button', { name: 'Slide 3' })).toHaveAttribute(
    'aria-current',
    'true'
  );
  await expect(
    strip.getByRole('button', { name: 'Slide 1' })
  ).not.toHaveAttribute('aria-current');
});

test('moving the main deck marks its thumbnail and brings it into view in the strip', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--thumbnails&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const strip = page.getByRole('region', { name: 'Thumbnails' });
  const thumb = (n: number) =>
    strip.getByRole('button', { name: `Slide ${n}` });
  // The strip shows the first few thumbnails, not the last.
  await expect(thumb(8)).not.toBeInViewport({ ratio: 1 });

  await deck.getByRole('group', { name: '8 of 8' }).scrollIntoViewIfNeeded();

  await expect(deck).toHaveAttribute('data-index', '7');
  await expect(thumb(8)).toHaveAttribute('aria-current', 'true');
  await expect(thumb(8)).toBeInViewport({ ratio: 1 });

  await deck.getByRole('button', { name: 'Previous' }).click();

  await expect(deck).toHaveAttribute('data-index', '6');
  await expect(thumb(7)).toHaveAttribute('aria-current', 'true');
  await expect(thumb(7)).toBeInViewport({ ratio: 1 });
});

test('following the main deck scrolls the strip, never the page', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--thumbnails&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const strip = page.getByRole('region', { name: 'Thumbnails' });
  // A window just tall enough for the main deck puts the strip below the fold.
  const stripTop = await strip.evaluate((el) => el.getBoundingClientRect().top);
  await page.setViewportSize({ width: 1280, height: Math.floor(stripTop) });
  await expect(strip).not.toBeInViewport();
  const thumbInStrip = (n: number) =>
    strip.getByRole('button', { name: `Slide ${n}` }).evaluate((thumb) => {
      const t = thumb.getBoundingClientRect();
      const s = thumb
        .closest('[data-slidedeck-viewport]')!
        .getBoundingClientRect();
      return t.left >= s.left - 1 && t.right <= s.right + 1;
    });
  expect(await thumbInStrip(6)).toBe(false);

  for (let i = 0; i < 5; i++) {
    await deck.getByRole('button', { name: 'Next' }).click();
  }

  await expect(deck).toHaveAttribute('data-index', '5');
  await expect.poll(() => thumbInStrip(6)).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(strip).not.toBeInViewport();
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
  // Held still before letting go, so the deck settles on the nearest slide:
  // Playwright's WebKit sends the moves within a few milliseconds, a speed
  // that would fling the deck on to the end.
  await page.waitForTimeout(100);
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

test('a vertical deck steps down with Next and comes to rest on a snap point after a short scroll', async ({
  page,
  browserName
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

  const box = (await viewport.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const moved = await watchScroll(page);
  await page.mouse.wheel(0, 40);
  // The scroll really moved the deck, so the rest below is not the start.
  expect(await moved()).toBeGreaterThan(0);

  if (browserName === 'chromium') {
    // Chromium scrolls 40px and snaps back to the same slide.
    await expect.poll(() => top(2)).toBe(0);
    await expect(deck).toHaveAttribute('data-index', '1');
    return;
  }
  // Firefox and WebKit take a wheel step under mandatory snapping as a move
  // to the next snap point, which the spec allows: the deck rests on slide
  // 3 and reports it.
  await expect.poll(() => top(3)).toBe(0);
  await expect(deck).toHaveAttribute('data-index', '2');
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
  // Held still before letting go, so the deck settles on the nearest slide:
  // Playwright's WebKit sends the moves within a few milliseconds, a speed
  // that would fling the deck on to the end.
  await page.waitForTimeout(100);
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

/**
 * A mouse flick on the deck's viewport: `distance` px along the axis, in six
 * moves 16ms apart, let go at once. Positive moves the pointer right, or down.
 * The moves are paced by the test, not the browser, so the release is as fast
 * in every engine: one snap point's flick, not a fling across several.
 */
async function flick(page: Page, distance: number, axis: 'x' | 'y' = 'x') {
  const viewport = page.locator('[data-slidedeck-viewport]').first();
  const box = (await viewport.boundingBox())!;
  const along = (d: number) =>
    axis === 'x'
      ? { x: box.x + box.width / 2 + d, y: box.y + box.height / 2 }
      : { x: box.x + box.width / 2, y: box.y + box.height / 2 + d };
  const start = along(-distance / 2);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let step = 1; step <= 6; step++) {
    await page.waitForTimeout(16);
    const at = along(-distance / 2 + (distance * step) / 6);
    await page.mouse.move(at.x, at.y);
  }
  await page.mouse.up();
}

// Loop (#11): a flick across the seam, each way, in every loop story. Back
// from the first snap point is the pointer moving toward the deck's end:
// right, down, or in right-to-left, left.
for (const { id, slides, last, back, axis } of [
  { id: 'deck--loop', slides: 6, last: 5, back: 200, axis: 'x' },
  { id: 'deck--loop-pages', slides: 10, last: 3, back: 200, axis: 'x' },
  { id: 'deck--loop-vertical', slides: 6, last: 5, back: 100, axis: 'y' },
  { id: 'deck--loop-right-to-left', slides: 6, last: 5, back: -200, axis: 'x' }
] as const) {
  test(`${id}: a flick back across the seam from the first snap point settles on the last`, async ({
    page
  }) => {
    await page.goto(`/iframe.html?id=${id}&viewMode=story`);
    const deck = page.getByRole('region', { name: 'Featured slides' });
    await expect(deck).toHaveAttribute('data-index', '0');

    await flick(page, back, axis);

    await expect(deck).toHaveAttribute('data-index', String(last));
    await expect(
      deck.getByRole('group', { name: `${slides} of ${slides}` })
    ).toBeInViewport({ ratio: 1 });
    await expect(deck.getByText(`${last + 1} / ${last + 1}`)).toBeVisible();
  });

  test(`${id}: a flick on across the seam from the last snap point settles on the first`, async ({
    page
  }) => {
    await page.goto(
      `/iframe.html?id=${id}&viewMode=story&args=defaultIndex:${last}`
    );
    const deck = page.getByRole('region', { name: 'Featured slides' });
    await expect(deck).toHaveAttribute('data-index', String(last));

    await flick(page, -back, axis);

    await expect(deck).toHaveAttribute('data-index', '0');
    await expect(
      deck.getByRole('group', { name: `1 of ${slides}` })
    ).toBeInViewport({ ratio: 1 });
    await expect(deck.getByText(`1 / ${last + 1}`)).toBeVisible();
  });
}

// Native snapping across the seam: a wheel step, which the browser scrolls
// and snaps, not the engine. Chromium scrolls the wheel's distance and snaps
// to the nearest snap point, Firefox and WebKit to the next one, so the step
// is one snap point's width either way.
for (const { id, slides, last, axis } of [
  { id: 'deck--loop', slides: 6, last: 5, axis: 'x' },
  { id: 'deck--loop-vertical', slides: 6, last: 5, axis: 'y' }
] as const) {
  for (const [way, from, to, label] of [
    ['back', 0, last, `${slides} of ${slides}`],
    ['on', last, 0, `1 of ${slides}`]
  ] as const) {
    test(`${id}: a wheel step ${way} across the seam settles on the snap point there`, async ({
      page
    }) => {
      await page.goto(
        `/iframe.html?id=${id}&viewMode=story&args=defaultIndex:${from}`
      );
      const deck = page.getByRole('region', { name: 'Featured slides' });
      await expect(deck).toHaveAttribute('data-index', String(from));
      const viewport = deck.locator('[data-slidedeck-viewport]');
      const box = (await viewport.boundingBox())!;
      // One snap point: a slide's width, or the viewport's height.
      const step = await deck
        .getByRole('group', { name: `1 of ${slides}` })
        .evaluate((el, vertical) => {
          const r = el.getBoundingClientRect();
          return vertical ? r.height : r.width;
        }, axis === 'y');
      const delta = way === 'on' ? step : -step;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const moved = await watchScroll(page);

      await page.mouse.wheel(
        axis === 'x' ? delta : 0,
        axis === 'y' ? delta : 0
      );

      expect(await moved()).toBeGreaterThan(0);
      await expect(deck).toHaveAttribute('data-index', String(to));
      await expect(deck.getByRole('group', { name: label })).toBeInViewport({
        ratio: 1
      });
    });
  }
}

test('a loop deck steps across the seam with Prev and Next, and no copy is reachable', async ({
  page
}) => {
  await page.goto('/iframe.html?id=deck--loop&viewMode=story');
  const deck = page.getByRole('region', { name: 'Featured slides' });
  const prev = deck.getByRole('button', { name: 'Previous' });
  const next = deck.getByRole('button', { name: 'Next' });
  // Three sets of slides in the document, one in the accessibility tree.
  await expect(deck.locator('[data-slidedeck-slide]')).toHaveCount(18);
  await expect(deck.getByRole('group', { name: / of 6$/ })).toHaveCount(6);

  await expect(prev).toBeEnabled();
  await prev.click();
  await expect(deck).toHaveAttribute('data-index', '5');
  await expect(next).toBeEnabled();
  await next.click();
  await expect(deck).toHaveAttribute('data-index', '0');
  await expect(deck.getByRole('group', { name: '1 of 6' })).toBeInViewport({
    ratio: 1
  });

  // Tab walks the slides' buttons and leaves the deck: never into a copy.
  await deck.getByRole('button', { name: 'Action 1' }).focus();
  for (let i = 2; i <= 6; i++) {
    await page.keyboard.press('Tab');
    await expect(
      deck.getByRole('button', { name: `Action ${i}` })
    ).toBeFocused();
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[data-slidedeck-copy]'))
      )
    ).toBe(false);
  }
});
