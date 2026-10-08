import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

// The built site, apps/site, which playwright.config.ts serves on its own port.
// SITE_URL moves it, for a run beside another worktree's.
const SITE_URL = process.env.SITE_URL ?? 'http://127.0.0.1:4174';
test.use({ baseURL: SITE_URL });

// The facts the landing page reads from the package README at build time,
// read here straight from the README, so the page cannot drift from it.
const README = readFileSync(
  new URL('../packages/react/README.md', import.meta.url),
  'utf8'
);
const COMPARISON = README.slice(
  README.indexOf('<!-- comparison:start -->'),
  README.indexOf('<!-- comparison:end -->')
);
/** The Min+gzip cell of a library's row in the README's comparison. */
const sizeOf = (library: string) =>
  new RegExp(`^\\| \`${library}\` +\\|[^|]+\\| ([\\d.]+ KB) +\\|`, 'm').exec(
    COMPARISON
  )![1]!;
const QUICKSTART = /## Quickstart\n\n```tsx\n([^]*?)\n```/.exec(README)![1]!;
const VERSION = (
  JSON.parse(
    readFileSync(
      new URL('../packages/react/package.json', import.meta.url),
      'utf8'
    )
  ) as { version: string }
).version;

const FEATURES = 'Features';
const CURVE = 'Curve effect';

/**
 * Opens the landing page and waits until its first deck has hydrated: the
 * engine marks a slide in view only once it runs in the browser.
 */
async function openHydrated(page: Page) {
  await page.goto('/');
  await waitHydrated(page.getByRole('region', { name: FEATURES }));
}

/** Waits until `deck` has hydrated, scrolling it into view to start it. */
async function waitHydrated(deck: Locator) {
  await deck.scrollIntoViewIfNeeded();
  await expect(
    deck.locator('[data-slidedeck-slide][data-in-view]').first()
  ).toBeAttached();
}

/** Every deck on the page, open and hydrated. */
async function openAllHydrated(page: Page) {
  await openHydrated(page);
  await waitHydrated(page.getByRole('region', { name: CURVE }));
  await page.evaluate(() => window.scrollTo(0, 0));
}

/**
 * Stops the feature deck's autoplay with its toggle, by keyboard so no
 * pointer rests on the deck, and returns the index the deck settles on: a
 * move autoplay started still ends where it was going.
 */
async function stopAutoplay(page: Page): Promise<number> {
  const deck = page.getByRole('region', { name: FEATURES });
  await deck
    .getByRole('button', { name: 'Stop slide rotation' })
    .press('Enter');
  await expect(
    deck.getByRole('button', { name: 'Start slide rotation' })
  ).toBeVisible();
  // At rest: the focal tile centred in the deck.
  await expect
    .poll(() =>
      deck.evaluate((root) => {
        const viewport = root.querySelector('[data-slidedeck-viewport]')!;
        const focal = root.querySelector('[data-slidedeck-slide][data-focal]')!;
        const a = viewport.getBoundingClientRect();
        const b = focal.getBoundingClientRect();
        return Math.abs(a.x + a.width / 2 - (b.x + b.width / 2));
      })
    )
    .toBeLessThan(1);
  return Number(await deck.getAttribute('data-index'));
}

const SCHEMES = ['light', 'dark'] as const;

for (const scheme of SCHEMES) {
  test.describe(`in the ${scheme} scheme`, () => {
    test.use({ colorScheme: scheme });

    test('the landing page passes axe', async ({ page }) => {
      await openAllHydrated(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });

    test('the landing page passes axe with autoplay stopped', async ({
      page
    }) => {
      await openHydrated(page);
      await stopAutoplay(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  });
}

// Contrast is axe's to check; this only checks that the scheme switches.
test('the ground and the text follow the color scheme', async ({ browser }) => {
  const colours = [];
  for (const colorScheme of SCHEMES) {
    const page = await browser.newPage({ colorScheme });
    await page.goto(SITE_URL);
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

test('the page ships JavaScript for its two decks and nothing else', async ({
  page
}) => {
  await page.goto('/');
  const islands = page.locator('fw-island');
  await expect(islands).toHaveCount(2);
  // Each island is one deck, and every deck is in one.
  for (const island of await islands.all()) {
    await expect(island.getByRole('region')).toHaveCount(1);
  }
  await expect(
    page.locator('[aria-roledescription="carousel"]:not(fw-island *)')
  ).toHaveCount(0);
  // The hero, the stats, the quickstart and the comparison are plain HTML.
  await expect(page.locator('fw-island h1, fw-island pre')).toHaveCount(0);
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
    await openAllHydrated(page);
    await expectNoSidewaysScroll(page);
  });

  // The system stack falls back to whatever a machine has: CI's Linux
  // runner draws it wider than SF or Helvetica. DejaVu Sans where it is
  // installed, and letter-spacing everywhere, so the text is wide on any
  // machine.
  test('a wide fallback font does not make the page scroll sideways', async ({
    page
  }) => {
    await openAllHydrated(page);
    await page.addStyleTag({
      content:
        "* { font-family: 'DejaVu Sans', Verdana, sans-serif !important; letter-spacing: 0.08em !important; }"
    });
    await expectNoSidewaysScroll(page);
  });
});

test('the current dot stretches', async ({ page }) => {
  await openHydrated(page);
  const dots = page
    .getByRole('region', { name: FEATURES })
    .locator('[data-slidedeck-dots] [data-index]');
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
for (const [name, count] of [
  [FEATURES, 6],
  [CURVE, 9]
] as const) {
  test(`every dot of the ${name} deck is a target of 24 by 24 at least`, async ({
    page
  }) => {
    await openAllHydrated(page);
    const dots = page
      .getByRole('region', { name })
      .locator('[data-slidedeck-dots] [data-index]');
    await expect(dots).toHaveCount(count);
    for (const dot of await dots.all()) {
      const box = await dot.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
  });
}

test('the autoplay toggle is 44 by 44 at least, stopped and playing', async ({
  page
}) => {
  await openHydrated(page);
  const deck = page.getByRole('region', { name: FEATURES });
  const toggle = deck.locator('[data-slidedeck-autoplay-toggle]');
  for (const playing of [true, false]) {
    if (!playing) await stopAutoplay(page);
    await expect(toggle).toHaveText(
      playing ? 'Stop slide rotation' : 'Start slide rotation'
    );
    const box = await toggle.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

for (const width of [1280, 375]) {
  test.describe(`at ${String(width)}px wide`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('the controls sit in one row under the slides, toggle first', async ({
      page
    }) => {
      await openHydrated(page);
      const deck = page.getByRole('region', { name: FEATURES });
      await expectControlsRow(deck, [
        deck.locator('[data-slidedeck-autoplay-toggle]'),
        deck.locator('[data-slidedeck-dots]')
      ]);
    });
  });
}

async function expectControlsRow(deck: Locator, controls: Locator[]) {
  const viewport = (await deck
    .locator('[data-slidedeck-viewport]')
    .boundingBox())!;
  const row = [];
  for (const control of controls) row.push((await control.boundingBox())!);
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

test.describe('the hero', () => {
  test('names the version and the promise, and links to start', async ({
    page
  }) => {
    await page.goto('/');
    const [major, minor] = VERSION.split('.');
    await expect(
      page.getByText(`slidedeck ${major!}.${minor!}`, { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Smooth. Natively.' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Get started' })
    ).toHaveAttribute('href', /packages\/react#quickstart$/);
    await expect(
      page.getByRole('main').getByRole('link', { name: /View on GitHub/ })
    ).toHaveAttribute('href', 'https://github.com/pedrosousa13/slidedeck');
  });
});

test.describe('the feature gallery', () => {
  test('has a slide for each feature', async ({ page }) => {
    await page.goto('/');
    const deck = page.getByRole('region', { name: FEATURES });
    await expect(deck.getByRole('group', { name: / of 6$/ })).toHaveCount(6);
    await expect(deck.getByRole('heading', { level: 3 })).toHaveText([
      /scroll/i,
      /first/i,
      /crossfade/i,
      /arc/i,
      /stops/i,
      /accessible/i
    ]);
  });

  // The documented behaviour (README, "Autoplay"), on this page.
  test('autoplays, and stops on the toggle', async ({ page }) => {
    await openHydrated(page);
    const deck = page.getByRole('region', { name: FEATURES });
    const toggle = deck.getByRole('button', { name: 'Stop slide rotation' });
    await expect(toggle).toHaveAttribute('data-playing');

    await expect(deck).toHaveAttribute('data-index', '1', { timeout: 10_000 });

    const at = await stopAutoplay(page);
    await expect(
      deck.locator('[data-slidedeck-autoplay-toggle]')
    ).not.toHaveAttribute('data-playing');
    // Longer than one autoplay step.
    await page.waitForTimeout(6000);
    await expect(deck).toHaveAttribute('data-index', String(at));
  });

  test('starts with autoplay stopped under reduced motion', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHydrated(page);
    const deck = page.getByRole('region', { name: FEATURES });
    await expect(
      deck.getByRole('button', { name: 'Start slide rotation' })
    ).toBeVisible();
    await expect(
      deck.locator('[data-slidedeck-autoplay-toggle]')
    ).not.toHaveAttribute('data-playing');
    await page.waitForTimeout(6000);
    await expect(deck).toHaveAttribute('data-index', '0');
  });

  test('rests with its first tile centred, and its last', async ({ page }) => {
    await openHydrated(page);
    const deck = page.getByRole('region', { name: FEATURES });
    await stopAutoplay(page);
    const viewport = (await deck
      .locator('[data-slidedeck-viewport]')
      .boundingBox())!;
    const centre = viewport.x + viewport.width / 2;
    for (const n of [1, 6]) {
      await deck.getByRole('button', { name: `Go to page ${n}` }).click();
      const slide = deck.getByRole('group', { name: `${n} of 6` });
      await expect(slide).toHaveAttribute('data-focal');
      await expect
        .poll(async () => {
          const box = (await slide.boundingBox())!;
          return Math.abs(box.x + box.width / 2 - centre);
        })
        .toBeLessThan(1);
    }
  });
});

test.describe('the stats', () => {
  test("give slidedeck's size from the README's comparison", async ({
    page
  }) => {
    await page.goto('/');
    const stats = page.getByRole('region', { name: /Feels native/ });
    await expect(stats).toContainText(sizeOf('@slidedeck/react'));
    await expect(stats).toContainText('stylesheets required');
    await expect(stats).toContainText('React 19');
  });
});

test.describe('the curve gallery', () => {
  test('is a looping deck with the curve effect', async ({ page }) => {
    await openAllHydrated(page);
    const deck = page.getByRole('region', { name: CURVE });
    await expect(deck.locator('[data-slidedeck-viewport]')).toHaveAttribute(
      'data-slidedeck-effect',
      'curve'
    );
    await expect(deck.getByRole('group', { name: / of 9$/ })).toHaveCount(9);
    // It starts on its middle card, the accent one.
    await expect(deck).toHaveAttribute('data-index', '4');
    // Looping: back from the first slide is the last.
    await deck.getByRole('button', { name: 'Go to page 1' }).click();
    await expect(deck).toHaveAttribute('data-index', '0');
    await deck.locator('[data-slidedeck-viewport]').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(deck).toHaveAttribute('data-index', '8');
  });
});

test.describe('the quickstart', () => {
  test("shows the README's quickstart, highlighted, and the install command", async ({
    page
  }) => {
    await page.goto('/');
    const section = page.getByRole('region', { name: /One deck/ });
    const code = section.locator('pre.shiki').filter({ hasText: 'Deck.Root' });
    await expect(code).toHaveText(QUICKSTART);
    await expect(code.locator('span[style*="color"]').first()).toBeAttached();
    await expect(section.getByText('pnpm add @slidedeck/react')).toBeVisible();
  });
});

test.describe('the comparison', () => {
  test("lists each library with its size from the README's comparison", async ({
    page
  }) => {
    await page.goto('/');
    const compare = page.getByRole('region', { name: 'Compare.' });
    const entries = compare.getByRole('listitem');
    await expect(entries).toHaveCount(3);
    for (const [i, library] of [
      '@slidedeck/react',
      'embla-carousel-react',
      'keen-slider'
    ].entries()) {
      await expect(entries.nth(i)).toContainText(library);
      await expect(entries.nth(i)).toContainText(sizeOf(library));
    }
  });
});

// Every deck works with the dots, the keyboard and a mouse drag; the
// feature deck with a touch swipe too, below.
for (const [name, start] of [
  [FEATURES, 0],
  [CURVE, 4]
] as const) {
  test.describe(`the ${name} deck`, () => {
    test('moves on a dot', async ({ page }) => {
      await openAllHydrated(page);
      const deck = page.getByRole('region', { name });
      await deck.scrollIntoViewIfNeeded();

      await deck.getByRole('button', { name: 'Go to page 3' }).click();
      await expect(deck).toHaveAttribute('data-index', '2');
      await expect(deck.getByRole('group', { name: /^3 of / })).toHaveAttribute(
        'data-focal'
      );
    });

    test('moves on the arrow keys', async ({ page }) => {
      await openAllHydrated(page);
      const deck = page.getByRole('region', { name });
      const from = name === FEATURES ? await stopAutoplay(page) : start;
      await deck.locator('[data-slidedeck-viewport]').focus();

      await page.keyboard.press('ArrowRight');

      await expect(deck).toHaveAttribute('data-index', String(from + 1));
    });

    test('moves on a mouse drag', async ({ page }) => {
      await openAllHydrated(page);
      const deck = page.getByRole('region', { name });
      const from = name === FEATURES ? await stopAutoplay(page) : start;
      await deck.scrollIntoViewIfNeeded();
      const focal = (await deck
        .locator('[data-slidedeck-slide][data-focal]')
        .boundingBox())!;
      const y = focal.y + focal.height / 2;

      await page.mouse.move(focal.x + focal.width - 20, y);
      await page.mouse.down();
      await page.mouse.move(focal.x + focal.width * 0.2, y, { steps: 12 });
      // Held still before letting go, so the deck settles on the nearest
      // slide rather than flinging on.
      await page.waitForTimeout(100);
      await page.mouse.up();

      await expect(deck).toHaveAttribute('data-index', String(from + 1));
    });
  });
}

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('a swipe moves the feature deck', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'CDP touch events are Chromium’s');
    await openHydrated(page);
    const deck = page.getByRole('region', { name: FEATURES });
    const from = await stopAutoplay(page);
    const box = (await deck
      .locator('[data-slidedeck-viewport]')
      .boundingBox())!;
    const y = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const at = (x: number) => [{ x, y, id: 1 }];
    const startX = box.x + box.width * 0.75;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: at(startX)
    });
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: at(startX - (box.width * 0.4 * step) / 6)
      });
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });

    await expect(deck).not.toHaveAttribute('data-index', String(from));
  });
});

test.describe('under reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing on the page animates', async ({ page }) => {
    await openAllHydrated(page);
    const deck = page.getByRole('region', { name: FEATURES });
    await deck.getByRole('button', { name: 'Go to page 2' }).click();
    await expect(deck).toHaveAttribute('data-index', '1');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('both decks render their slides as HTML', async ({ page }) => {
    await page.goto('/');
    await expect(
      page
        .getByRole('region', { name: FEATURES })
        .getByRole('group', { name: / of 6$/ })
    ).toHaveCount(6);
    await expect(
      page
        .getByRole('region', { name: CURVE })
        .getByRole('group', { name: / of 9$/ })
    ).toHaveCount(9);
  });
});
