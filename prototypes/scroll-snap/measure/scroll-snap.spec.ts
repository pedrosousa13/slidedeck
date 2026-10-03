// THROWAWAY (#3). Drives each technique page and records what happened.
//
// It asserts nothing about the techniques: every run appends one JSON line
// per scenario to measure-results/<browser>.jsonl, and FINDINGS.md is
// written from those lines. What a desktop harness cannot do -- a real
// touch flick with iOS momentum, a real screen reader -- is left to the
// on-device checklist in FINDINGS.md.

import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { test, type Page } from '@playwright/test';
import type {} from '../src/page';

const OUT = fileURLToPath(new URL('../measure-results/', import.meta.url));

interface Config {
  page: string;
  query: string;
}

const base = ['', 'group=1', 'vertical=1', 'rtl=1'];
const configs: Config[] = [
  ...[...base, 'clones=viewport', 'fix=live', 'guard=0'].map((query) => ({
    page: 'loop-clone-jump',
    query
  })),
  ...[...base, 'mode=order', 'fix=live', 'guard=0'].map((query) => ({
    page: 'loop-reposition',
    query
  })),
  ...[...base, 'handoff=restore', 'handoff=restore&group=1'].map((query) => ({
    page: 'drag',
    query
  })),
  ...[
    '',
    'vertical=1',
    'rtl=1',
    'driver=css',
    'driver=css&rtl=1',
    'hide=none'
  ].map((query) => ({
    page: 'fade',
    query
  }))
];

// The `measure` script empties measure-results/ before a run.
let file = '';
test.beforeAll(({ browserName }) => {
  mkdirSync(OUT, { recursive: true });
  file = `${OUT}${browserName}.jsonl`;
});

const record = (row: Record<string, unknown>) =>
  appendFileSync(file, `${JSON.stringify(row)}\n`);

async function open(page: Page, config: Config) {
  await page.goto(`${config.page}.html?${config.query}`);
  await page.waitForFunction(() => window.__probe !== undefined);
  // Let the initial positioning settle before measuring anything.
  await page.waitForTimeout(300);
}

async function settle(page: Page) {
  await page.waitForTimeout(150);
  await page.waitForFunction(() => window.__probe.idleFor() > 500, null, {
    timeout: 15_000
  });
}

async function goTo(page: Page, index: number) {
  await page.evaluate((i) => window.__probe.goTo(i), index);
  await settle(page);
  await page.evaluate(() => window.__probe.reset());
}

interface Geometry {
  vertical: boolean;
  rtl: boolean;
  n: number;
  pageSize: number;
  pageExtent: number;
  cx: number;
  cy: number;
  loops: boolean;
}

async function geometry(page: Page, config: Config): Promise<Geometry> {
  return page.evaluate((loops) => {
    const vp = document.querySelector<HTMLElement>('#viewport')!;
    const box = vp.getBoundingClientRect();
    return {
      vertical: vp.classList.contains('vertical'),
      rtl: vp.dir === 'rtl',
      n: window.__probe.n,
      pageSize: window.__probe.pageSize,
      pageExtent: window.__probe.pageExtent(),
      cx: box.left + box.width / 2,
      cy: box.top + box.height / 2,
      loops
    };
  }, config.page.startsWith('loop'));
}

/** Screen-space unit vector for logical direction `dir` (+1 = forward). */
function screen(g: Geometry, dir: number): { x: number; y: number } {
  if (g.vertical) return { x: 0, y: dir };
  return { x: g.rtl ? -dir : dir, y: 0 };
}

const wrapIndex = (g: Geometry, i: number) => ((i % g.n) + g.n) % g.n;

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const p = window.__probe;
    return {
      focal: p.focal(),
      snapError: Math.round(p.snapError() * 10) / 10,
      ...p.m,
      release: p.lastRelease() ?? null
    };
  });
}

type Scenario = {
  name: string;
  /** Start slide; the seam is just before slide 0 on loop pages. */
  start(g: Geometry): number;
  /** Expected final slide, where the scenario defines one. */
  expect?(g: Geometry, start: number): number;
  /** Instead of `expect`: whether the final slide is acceptable. */
  accept?(g: Geometry, start: number, end: number): boolean;
  run(page: Page, g: Geometry): Promise<void>;
  only?: string;
  /** Run in a fresh touch-enabled context instead of the project's page. */
  touch?: boolean;
};

const backStart = (g: Geometry) => (g.loops ? 0 : 6);
const fwdStart = (g: Geometry) => (g.loops ? g.n - g.pageSize : 6);

async function wheelFlick(page: Page, g: Geometry, dir: number) {
  const v = screen(g, dir);
  await page.mouse.move(g.cx, g.cy);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(v.x * 200, v.y * 200);
    await page.waitForTimeout(16);
  }
}

async function mouseDrag(
  page: Page,
  g: Geometry,
  dir: number,
  distance: number,
  steps: number,
  stepMs: number,
  holdMs: number
) {
  // Dragging content backward means moving the pointer forward on screen.
  // Centre the stroke on the viewport so the pointer never leaves the page.
  const v = screen(g, -dir);
  const x0 = g.cx - (v.x * distance) / 2;
  const y0 = g.cy - (v.y * distance) / 2;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      x0 + (v.x * distance * i) / steps,
      y0 + (v.y * distance * i) / steps
    );
    if (stepMs) await page.waitForTimeout(stepMs);
  }
  if (holdMs) await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

const scenarios: Scenario[] = [
  {
    name: 'wheel-flick-back',
    start: backStart,
    run: (page, g) => wheelFlick(page, g, -1)
  },
  {
    name: 'wheel-flick-fwd',
    start: fwdStart,
    run: (page, g) => wheelFlick(page, g, 1)
  },
  {
    name: 'smooth-scrollBy-3-pages-back',
    start: backStart,
    run: (page, g) =>
      page.evaluate((px) => window.__probe.by(px), -3 * g.pageExtent)
  },
  {
    name: 'next-x5-fast',
    start: fwdStart,
    async run(page) {
      for (let i = 0; i < 5; i++) {
        await page.click('#next');
        await page.waitForTimeout(40);
      }
    }
  },
  {
    // A raw touch flick (CDP touch events) in a touch-enabled context:
    // Chromium turns it into a scroll with fling, as on a phone.
    name: 'touch-flick-back',
    only: 'chromium',
    touch: true,
    start: backStart,
    async run(page, g) {
      const cdp = await page.context().newCDPSession(page);
      const v = screen(g, -1);
      // The finger moves opposite to the content's logical direction.
      const span = (g.vertical ? 300 : 600) / 2;
      const at = (t: number) => [
        { x: g.cx - v.x * span * t, y: g.cy - v.y * span * t, id: 1 }
      ];
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: at(-1)
      });
      for (let i = 1; i <= 10; i++) {
        await page.waitForTimeout(4);
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: at(-1 + i / 5)
        });
      }
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
    }
  },
  {
    name: 'drag-flick-back',
    start: backStart,
    // A flick carries at least one page back; how far depends on speed.
    accept: (g, s, end) => {
      const moved = wrapIndex(g, s - end);
      return moved >= g.pageSize && moved < g.n / 2;
    },
    run: (page, g) => mouseDrag(page, g, -1, 240, 6, 8, 0)
  },
  {
    name: 'drag-slow-short',
    start: backStart,
    expect: (_g, s) => s,
    run: (page, g) => mouseDrag(page, g, -1, g.pageExtent * 0.25, 15, 30, 150)
  },
  {
    name: 'drag-slow-long',
    start: backStart,
    expect: (g, s) => wrapIndex(g, s - g.pageSize),
    run: (page, g) => mouseDrag(page, g, -1, g.pageExtent * 0.65, 25, 30, 150)
  }
];

async function focusWalk(page: Page) {
  await page.locator('#controls :is(input, select):enabled').last().focus();
  const steps: {
    index: number | null;
    clone: boolean;
    invisible: boolean;
    offscreen: boolean;
  }[] = [];
  let entered = false;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(80);
    await settle(page);
    const step = await page.evaluate(() => {
      const el = document.activeElement;
      const vp = document.querySelector('#viewport')!;
      if (!el || !vp.contains(el) || el === vp) {
        return { inDeck: el === vp, onSlide: false } as const;
      }
      const slide = el.closest<HTMLElement>('.slide')!;
      const box = slide.getBoundingClientRect();
      const view = vp.getBoundingClientRect();
      const visible =
        box.right > view.left + 1 &&
        box.left < view.right - 1 &&
        box.bottom > view.top + 1 &&
        box.top < view.bottom - 1;
      return {
        inDeck: true,
        onSlide: true,
        index: Number(slide.dataset.index),
        clone: slide.closest('[data-clone]') !== null,
        invisible: Number(getComputedStyle(slide).opacity) < 0.5,
        offscreen: !visible
      } as const;
    });
    if (step.inDeck) entered = true;
    else if (entered) break;
    if (step.onSlide) {
      steps.push({
        index: step.index,
        clone: step.clone,
        invisible: step.invisible,
        offscreen: step.offscreen
      });
    }
  }
  const lost = await page.evaluate(() => window.__probe.m.focusLost);
  return {
    // Slide and its button are both tab stops; keep one entry per slide.
    sequence: steps.map((s) => s.index).filter((v, i, all) => v !== all[i - 1]),
    cloneLandings: steps.filter((s) => s.clone).length,
    invisibleLandings: steps.filter((s) => s.invisible).length,
    offscreenLandings: steps.filter((s) => s.offscreen).length,
    offscreenAt: steps.filter((s) => s.offscreen).map((s) => s.index),
    focusLost: lost
  };
}

async function accessibility(page: Page, browserName: string) {
  const snap = await page.locator('#viewport').ariaSnapshot();
  const labels = snap.match(/Slide \d+ of \d+/g) ?? [];
  const row: Record<string, unknown> = {
    ariaSnapshotSlides: labels.length,
    ariaSnapshotDistinct: new Set(labels).size
  };
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
      nodes: { ignored: boolean; name?: { value?: string } }[];
    };
    const named = nodes.filter(
      (n) => !n.ignored && /^Slide \d+ of \d+$/.test(n.name?.value ?? '')
    );
    row.chromeAxSlides = named.length;
    row.chromeAxDistinct = new Set(named.map((n) => n.name?.value)).size;
  }
  return row;
}

/** Hold the fade a quarter of the way from slide 3 to 4 and look at it. */
async function fadeGeometry(page: Page) {
  return page.evaluate(async () => {
    const vp = document.querySelector<HTMLElement>('#viewport')!;
    vp.style.scrollSnapType = 'none';
    const vertical = vp.classList.contains('vertical');
    const p = 2.25 * (vertical ? vp.clientHeight : vp.clientWidth);
    if (vertical) vp.scrollTop = p;
    else vp.scrollLeft = vp.dir === 'rtl' ? -p : p;
    await new Promise((r) => setTimeout(r, 300));
    const view = vp.getBoundingClientRect();
    const slides = [...vp.querySelectorAll<HTMLElement>('.slide')];
    return {
      cssDriven: vp.classList.contains('css-driven'),
      // Every slide should sit exactly on the viewport (sticky held).
      maxSlideOffset: Math.max(
        ...slides.map((s) => {
          const box = s.getBoundingClientRect();
          return Math.round(
            Math.abs(box.left - view.left) + Math.abs(box.top - view.top)
          );
        })
      ),
      // Expected 0 0 0.75 0.25 0.
      opacity: slides
        .slice(0, 5)
        .map((s) => Number(getComputedStyle(s).opacity).toFixed(2))
        .join(' ')
    };
  });
}

test('browser features', async ({ page, browserName }) => {
  await page.goto('index.html');
  record({
    browser: browserName,
    kind: 'features',
    ...(await page.evaluate(() => ({
      scrollend: 'onscrollend' in window,
      scrollsnapchange: 'onscrollsnapchange' in window,
      moveBefore: 'moveBefore' in Element.prototype,
      scrollTimelines: CSS.supports('animation-timeline: scroll()'),
      userAgent: navigator.userAgent
    })))
  });
});

for (const config of configs) {
  test(`${config.page}?${config.query}`, async ({
    page: projectPage,
    browser,
    browserName
  }) => {
    const label = { browser: browserName, ...config };
    for (const scenario of scenarios) {
      if (scenario.only && scenario.only !== browserName) continue;
      const page = scenario.touch
        ? await (
            await browser.newContext({
              viewport: projectPage.viewportSize(),
              hasTouch: true
            })
          ).newPage()
        : projectPage;
      await open(page, config);
      const g = await geometry(page, config);
      const start = scenario.start(g);
      await goTo(page, start);
      const began = Date.now();
      let error: string | undefined;
      try {
        await scenario.run(page, g);
        await settle(page);
      } catch (e) {
        error = String(e).slice(0, 200);
      }
      const after = await snapshot(page);
      const expected = scenario.expect?.(g, start);
      record({
        ...label,
        kind: 'scenario',
        scenario: scenario.name,
        start,
        expected: expected ?? null,
        ok: scenario.accept
          ? scenario.accept(g, start, after.focal)
          : expected === undefined
            ? null
            : after.focal === expected,
        ms: Date.now() - began,
        error,
        ...after
      });
      if (scenario.touch) await page.context().close();
    }

    await open(projectPage, config);
    record({ ...label, kind: 'focus', ...(await focusWalk(projectPage)) });
    if (config.page === 'fade') {
      await open(projectPage, config);
      record({ ...label, kind: 'fade', ...(await fadeGeometry(projectPage)) });
    }
    await open(projectPage, config);
    record({
      ...label,
      kind: 'a11y',
      ...(await accessibility(projectPage, browserName))
    });
  });
}
