import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

// The Examples page, /examples/, built from apps/site. The site is served as
// in e2e/site.spec.ts; SITE_URL moves it.
const SITE_URL = process.env.SITE_URL ?? 'http://127.0.0.1:4174';
test.use({ baseURL: SITE_URL });

const RTL = 'وجهات للسفر';

/** Each example: its title, its deck's name and how it moves. */
const EXAMPLES = [
  {
    title: 'Product gallery',
    deck: 'Product photos',
    slides: 4,
    start: 0,
    key: 'ArrowRight',
    // Drag the content toward the start: the next photo comes in.
    drag: { x: -1, y: 0 },
    control: 'Go to page 3',
    to: 2
  },
  {
    title: 'Hero banner',
    deck: 'Trips',
    slides: 3,
    start: 0,
    key: 'ArrowRight',
    drag: { x: -1, y: 0 },
    control: 'Go to page 3',
    to: 2
  },
  {
    title: 'Testimonials',
    deck: 'Customer reviews',
    slides: 5,
    start: 0,
    key: 'ArrowRight',
    drag: { x: -1, y: 0 },
    control: 'Next',
    to: 1
  },
  {
    title: 'Stories',
    deck: 'Travel stories',
    slides: 4,
    start: 0,
    key: 'ArrowDown',
    drag: { x: 0, y: -1 },
    control: 'Next',
    to: 1
  },
  {
    title: 'Right to left',
    deck: RTL,
    slides: 5,
    start: 0,
    // Next is toward the left in a right-to-left deck.
    key: 'ArrowLeft',
    drag: { x: 1, y: 0 },
    control: 'التالي',
    to: 1
  },
  {
    title: 'Cover flow',
    deck: 'Albums',
    slides: 7,
    start: 3,
    key: 'ArrowRight',
    drag: { x: -1, y: 0 },
    control: 'Go to page 6',
    to: 5
  }
] as const;

const HERO = 'Trips';

/** Waits until `deck` has hydrated, scrolling it into view to start it. */
async function waitHydrated(deck: Locator) {
  await deck.scrollIntoViewIfNeeded();
  await expect(
    deck.locator('[data-slidedeck-slide][data-in-view]').first()
  ).toBeAttached();
}

/** Opens /examples/ with every deck hydrated, scrolled back to the top. */
async function openAllHydrated(page: Page) {
  await page.goto('/examples/');
  for (const { deck } of EXAMPLES) {
    await waitHydrated(page.getByRole('region', { name: deck }));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Stops the hero's autoplay by keyboard, and returns where it settles. */
async function stopAutoplay(page: Page): Promise<number> {
  const deck = page.getByRole('region', { name: HERO });
  await deck
    .getByRole('button', { name: 'Stop slide rotation' })
    .press('Enter');
  await expect(
    deck.getByRole('button', { name: 'Start slide rotation' })
  ).toBeVisible();
  // A move autoplay started still ends where it was going.
  let settled = -1;
  await expect
    .poll(async () => {
      const at = Number(await deck.getAttribute('data-index'));
      const still = at === settled;
      settled = at;
      return still;
    })
    .toBe(true);
  return settled;
}

/** Where `name` rests before a move: the hero's autoplay stopped first. */
async function from(page: Page, name: string, start: number) {
  return name === HERO ? await stopAutoplay(page) : start;
}

const SCHEMES = ['light', 'dark'] as const;

for (const scheme of SCHEMES) {
  test.describe(`in the ${scheme} scheme`, () => {
    test.use({ colorScheme: scheme });

    test('the page passes axe', async ({ page }) => {
      await openAllHydrated(page);
      await stopAutoplay(page);
      // Curve fades each slide with its distance from the focal one, by
      // design, so contrast is checked on its focal slide only, as
      // e2e/docs.spec.ts does.
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
  });
}

test('the nav bar links to the page', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('banner')
    .getByRole('link', { name: 'Examples' })
    .click();
  await expect(page).toHaveURL(/\/examples\/$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Examples' })
  ).toBeVisible();
});

test('shows each example framed, titled, described and linked to its code', async ({
  page
}) => {
  await page.goto('/examples/');
  const examples = page.locator('.example');
  await expect(examples.getByRole('heading', { level: 2 })).toHaveText(
    EXAMPLES.map(({ title }) => title)
  );
  for (const [i, { deck }] of EXAMPLES.entries()) {
    const example = examples.nth(i);
    await expect(example.locator('h2 + p')).not.toBeEmpty();
    await expect(example.getByRole('region', { name: deck })).toHaveCount(1);
    const code = example.getByRole('link', { name: 'View code ›' });
    const href = (await code.getAttribute('href'))!;
    expect(href).toMatch(/^\/docs\/.+\/$/);
    expect((await page.request.get(href)).status()).toBe(200);
  }
});

test('each deck is an island of its own', async ({ page }) => {
  await page.goto('/examples/');
  await expect(page.locator('main fw-island')).toHaveCount(EXAMPLES.length);
  for (const island of await page.locator('main fw-island').all()) {
    await expect(
      island.locator('[aria-roledescription="carousel"]')
    ).toHaveCount(1);
  }
  await expect(page.locator('fw-island h1, fw-island h2')).toHaveCount(0);
});

test.describe('the photos', () => {
  test('are served from the site, sized, and lazy below the first example', async ({
    page
  }) => {
    await page.goto('/examples/');
    const images = page.locator('main img');
    expect(await images.count()).toBeGreaterThan(10);
    const first = page.locator('.example').first();
    for (const image of await images.all()) {
      const src = (await image.getAttribute('src'))!;
      expect(src).toMatch(/^\/photos\/[\w-]+\.(avif|webp)$/);
      expect(Number(await image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(await image.getAttribute('height'))).toBeGreaterThan(0);
      const inFirst = await image.evaluate(
        (img, root) => root!.contains(img),
        await first.elementHandle()
      );
      if (!inFirst) await expect(image).toHaveAttribute('loading', 'lazy');
    }
    const sources = new Set(
      await images.evaluateAll((all) =>
        all.map((img) => img.getAttribute('src')!)
      )
    );
    for (const src of sources) {
      const response = await page.request.get(src);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toMatch(/^image\//);
    }
  });

  test('credit each photographer with a link to Unsplash', async ({ page }) => {
    await page.goto('/examples/');
    const credits = page.getByRole('region', { name: 'Photo credits' });
    const links = credits.getByRole('link');
    expect(await links.count()).toBeGreaterThan(5);
    for (const link of await links.all()) {
      expect(await link.getAttribute('href')).toMatch(
        /^https:\/\/unsplash\.com\/photos\/[\w-]+$/
      );
      await expect(link).not.toBeEmpty();
    }
  });
});

for (const { deck: name, slides, start, key, drag, control, to } of EXAMPLES) {
  test.describe(`the ${name} deck`, () => {
    test(`has ${String(slides)} slides`, async ({ page }) => {
      await page.goto('/examples/');
      const deck = page.getByRole('region', { name });
      await expect(
        deck.locator('[data-slidedeck-slide]:not([data-slidedeck-copy])')
      ).toHaveCount(slides);
    });

    test('moves on its controls', async ({ page }) => {
      await openAllHydrated(page);
      const deck = page.getByRole('region', { name });
      if (name === HERO) await stopAutoplay(page);
      await deck.scrollIntoViewIfNeeded();
      await deck.getByRole('button', { name: control, exact: true }).click();
      await expect(deck).toHaveAttribute('data-index', String(to));
    });

    test('moves on the arrow keys', async ({ page }) => {
      await openAllHydrated(page);
      const deck = page.getByRole('region', { name });
      const at = await from(page, name, start);
      await deck.locator('[data-slidedeck-viewport]').focus();
      await page.keyboard.press(key);
      await expect(deck).toHaveAttribute(
        'data-index',
        String((at + 1) % slides)
      );
    });

    test('moves on a mouse drag', async ({ page }) => {
      await openAllHydrated(page);
      const deck = page.getByRole('region', { name });
      const at = await from(page, name, start);
      await deck.scrollIntoViewIfNeeded();
      const box = (await deck
        .locator('[data-slidedeck-slide][data-focal]')
        .boundingBox())!;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      // Most of a slide, so the nearest slide is the next.
      const dx = drag.x * box.width * 0.7;
      const dy = drag.y * box.height * 0.7;
      await page.mouse.move(cx - dx / 2, cy - dy / 2);
      await page.mouse.down();
      await page.mouse.move(cx + dx / 2, cy + dy / 2, { steps: 12 });
      // Held still before letting go, so the deck settles on the nearest
      // slide rather than flinging on.
      await page.waitForTimeout(100);
      await page.mouse.up();
      await expect(deck).toHaveAttribute(
        'data-index',
        String((at + 1) % slides)
      );
    });
  });
}

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  for (const { deck: name, start, drag } of EXAMPLES) {
    test(`a swipe moves the ${name} deck`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'CDP touch events are Chromium’s');
      await openAllHydrated(page);
      const deck = page.getByRole('region', { name });
      const at = await from(page, name, start);
      await deck.scrollIntoViewIfNeeded();
      const box = (await deck
        .locator('[data-slidedeck-viewport]')
        .boundingBox())!;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const cdp = await page.context().newCDPSession(page);
      const point = (t: number) => [
        {
          x: cx + drag.x * box.width * (t - 0.5) * 0.4,
          y: cy + drag.y * box.height * (t - 0.5) * 0.4,
          id: 1
        }
      ];
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: point(0)
      });
      for (let step = 1; step <= 6; step++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: point(step / 6)
        });
      }
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
      await expect(deck).not.toHaveAttribute('data-index', String(at));
    });
  }
});

test.describe('the product gallery', () => {
  test('has a thumbnail of each photo for its pages, the current one marked', async ({
    page
  }) => {
    await openAllHydrated(page);
    const deck = page.getByRole('region', { name: 'Product photos' });
    const thumbs = deck
      .getByRole('group', { name: 'Choose page' })
      .getByRole('button');
    await expect(thumbs).toHaveCount(4);
    for (const thumb of await thumbs.all()) {
      await expect(thumb.locator('img')).toHaveCount(1);
    }
    await expect(thumbs.nth(0)).toHaveAttribute('aria-current', 'true');
    await thumbs.nth(3).click();
    await expect(deck).toHaveAttribute('data-index', '3');
    await expect(thumbs.nth(3)).toHaveAttribute('aria-current', 'true');
    await expect(thumbs.nth(0)).not.toHaveAttribute('aria-current', 'true');
  });
});

test.describe('the hero banner', () => {
  test('crossfades, and autoplays with its toggle first among the controls', async ({
    page
  }) => {
    await openAllHydrated(page);
    const deck = page.getByRole('region', { name: HERO });
    await expect(deck.locator('[data-slidedeck-viewport]')).toHaveAttribute(
      'data-slidedeck-effect',
      'fade'
    );
    const toggle = deck.locator('[data-slidedeck-autoplay-toggle]');
    await expect(toggle).toHaveAttribute('data-playing');
    // The toggle is the first control after the slides.
    await expect(
      deck
        .locator('[data-slidedeck-viewport] ~ :not([data-slidedeck-live])')
        .first()
    ).toHaveAttribute('data-slidedeck-autoplay-toggle');
    await deck.scrollIntoViewIfNeeded();
    await expect(deck).toHaveAttribute('data-index', '1', { timeout: 10_000 });
    const at = await stopAutoplay(page);
    await page.waitForTimeout(6000);
    await expect(deck).toHaveAttribute('data-index', String(at));
  });
});

test.describe('the testimonials', () => {
  test('rest with the first card centred, and the last', async ({ page }) => {
    await openAllHydrated(page);
    const deck = page.getByRole('region', { name: 'Customer reviews' });
    await deck.scrollIntoViewIfNeeded();
    const viewport = (await deck
      .locator('[data-slidedeck-viewport]')
      .boundingBox())!;
    const centre = viewport.x + viewport.width / 2;
    for (const n of [1, 5]) {
      await deck.getByRole('button', { name: `Go to page ${n}` }).click();
      const slide = deck.getByRole('group', { name: `${n} of 5` });
      await expect(slide).toHaveAttribute('data-focal');
      await expect
        .poll(async () => {
          const box = (await slide.boundingBox())!;
          return Math.abs(box.x + box.width / 2 - centre);
        })
        .toBeLessThan(1);
    }
  });

  test('show the neighbours either side of the focal card', async ({
    page
  }) => {
    await openAllHydrated(page);
    const deck = page.getByRole('region', { name: 'Customer reviews' });
    await deck.getByRole('button', { name: 'Go to page 3' }).click();
    await expect(deck).toHaveAttribute('data-index', '2');
    for (const n of [2, 4]) {
      await expect(
        deck.getByRole('group', { name: `${n} of 5` })
      ).toHaveAttribute('data-in-view');
    }
  });
});

test.describe('the stories', () => {
  test('scroll vertically in a phone-shaped frame', async ({ page }) => {
    await openAllHydrated(page);
    const deck = page.getByRole('region', { name: 'Travel stories' });
    const viewport = deck.locator('[data-slidedeck-viewport]');
    await expect(viewport).toHaveAttribute('data-orientation', 'vertical');
    const box = (await viewport.boundingBox())!;
    expect(box.height).toBeGreaterThan(box.width * 1.6);
  });
});

test.describe('the right-to-left deck', () => {
  test('is in an Arabic, right-to-left container and starts at the right', async ({
    page
  }) => {
    await openAllHydrated(page);
    const container = page.locator('[lang="ar"][dir="rtl"]');
    const deck = container.getByRole('region', { name: RTL });
    await expect(deck).toHaveCount(1);
    await deck.scrollIntoViewIfNeeded();
    const viewport = (await deck
      .locator('[data-slidedeck-viewport]')
      .boundingBox())!;
    const first = (await deck
      .getByRole('group', { name: '1 of 5' })
      .boundingBox())!;
    expect(
      Math.abs(viewport.x + viewport.width - (first.x + first.width))
    ).toBeLessThan(2);
    await expect(deck.getByRole('heading', { level: 3 }).first()).toHaveText(
      /[؀-ۿ]/
    );
  });
});

test.describe('the cover flow', () => {
  test('curves, loops, and keeps each cover across the seam', async ({
    page
  }) => {
    await openAllHydrated(page);
    const deck = page.getByRole('region', { name: 'Albums' });
    await expect(deck.locator('[data-slidedeck-viewport]')).toHaveAttribute(
      'data-slidedeck-effect',
      'curve'
    );
    await deck.getByRole('button', { name: 'Go to page 1' }).click();
    await expect(deck).toHaveAttribute('data-index', '0');
    await deck.locator('[data-slidedeck-viewport]').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(deck).toHaveAttribute('data-index', '6');

    // A loop's copies are slides too: a cover styled by its position would
    // differ from its copy.
    const covers = await deck
      .locator('[data-slidedeck-slide] > *')
      .evaluateAll((all) =>
        all.map((cover) => ({
          name: cover.getAttribute('data-album'),
          copy: cover.parentElement!.hasAttribute('data-slidedeck-copy'),
          background: getComputedStyle(cover).backgroundImage
        }))
      );
    const of = (name: string | null) =>
      covers.find((cover) => cover.name === name && !cover.copy)!.background;
    expect(covers.some((cover) => cover.copy)).toBe(true);
    for (const cover of covers) expect(cover.background).toBe(of(cover.name));
    expect(new Set(covers.map((cover) => cover.background)).size).toBe(7);
  });
});

test.describe('under reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the hero starts stopped and nothing on the page animates', async ({
    page
  }) => {
    await openAllHydrated(page);
    const deck = page.getByRole('region', { name: HERO });
    await expect(
      deck.getByRole('button', { name: 'Start slide rotation' })
    ).toBeVisible();
    await page.waitForTimeout(6000);
    await expect(deck).toHaveAttribute('data-index', '0');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

for (const width of [320, 390]) {
  test.describe(`at ${String(width)}px wide`, () => {
    test.use({ viewport: { width, height: 740 } });

    test('the page does not scroll sideways', async ({ page }) => {
      await openAllHydrated(page);
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      }));
      expect(scroll).toBe(client);
    });

    // A viewport clips its slides, so a slide wider than it would cut its
    // words off without the page scrolling sideways.
    test('every slide fits its deck', async ({ page }) => {
      await openAllHydrated(page);
      const over = await page.evaluate(() =>
        [...document.querySelectorAll('[data-slidedeck-viewport]')].flatMap(
          (viewport) =>
            [...viewport.querySelectorAll('[data-slidedeck-slide] > *')]
              .filter(
                // Its layout width: an effect may turn it, which widens its
                // box.
                (content) =>
                  (content as HTMLElement).offsetWidth > viewport.clientWidth
              )
              .map((content) => content.className)
        )
      );
      expect(over).toEqual([]);
    });
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every deck renders its slides as HTML', async ({ page }) => {
    await page.goto('/examples/');
    for (const { deck, slides } of EXAMPLES) {
      await expect(
        page
          .getByRole('region', { name: deck })
          .getByRole('group', { name: new RegExp(` of ${String(slides)}$`) })
      ).toHaveCount(slides);
    }
  });
});
