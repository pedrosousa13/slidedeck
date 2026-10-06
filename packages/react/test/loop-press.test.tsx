import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import * as Deck from '@slidedeck/react';
import {
  addStyle,
  CENTRED,
  expectRestOnASlide,
  expectSettledTo,
  mouseAt,
  mouseDrag,
  nextFrame,
  pagesOf,
  parkMouse,
  TestDeck,
  sleep,
  touchAt,
  touchSwipe,
  gestureScroll,
  viewportOf,
  WIDTH
} from './fixtures';

// Loop jumps off a copy at a settle (ADR-0009), and at a press (amended for
// #48): swipes chained faster than the deck comes to rest are one long
// scroll, with no settle to jump at, and would run through the copies to an
// end of the scroll range. A touch or pen pressed on the viewport while it
// is on the copies, or a mouse drag starting there, moves it a set back onto
// the slides first, where nothing shows.

const HEIGHT = 200;

// Whether a finger or the mouse button is down, as the page first hears it:
// registered before any deck, so before a deck's own window listeners.
let down = false;
window.addEventListener('pointerdown', () => (down = true), { capture: true });
for (const type of ['touchend', 'touchcancel', 'pointerup']) {
  window.addEventListener(
    type,
    (event) => {
      if (!('touches' in event) || (event as TouchEvent).touches.length === 0) {
        down = false;
      }
    },
    { capture: true }
  );
}

type Shape = {
  vertical?: boolean;
  rtl?: boolean;
  pages?: boolean;
  centred?: boolean;
};

/** A looping deck of five slides the viewport's size; with `pages`, ten
 * slides a third of it, in pages of three, as the LoopPages story; with
 * `centred`, 3.5 slides in view, centred, as the Loop story's peek. */
function LoopDeck({
  vertical = false,
  rtl = false,
  pages = false,
  centred = false,
  ...props
}: Parameters<typeof Deck.Root>[0] & Shape) {
  return (
    <div dir={rtl ? 'rtl' : 'ltr'}>
      <Deck.Root
        aria-label="Test deck"
        loop
        orientation={vertical ? 'vertical' : 'horizontal'}
        {...props}
      >
        <Deck.Prev />
        <Deck.Viewport
          className={pages ? 'pages' : centred ? 'centred' : undefined}
          style={{ width: WIDTH, height: HEIGHT }}
        >
          {Array.from({ length: pages ? 10 : 5 }, (_, i) => (
            <Deck.Slide key={i}>
              <button type="button">Button {i + 1}</button>
            </Deck.Slide>
          ))}
        </Deck.Viewport>
        <Deck.Next />
      </Deck.Root>
    </div>
  );
}

function renderLoop({
  vertical = false,
  rtl = false,
  pages = false,
  centred = false,
  ...props
}: Parameters<typeof Deck.Root>[0] & Shape = {}) {
  if (pages) addStyle(`${pagesOf(3)} .pages > * { width: calc(100% / 3); }`);
  if (centred) addStyle(CENTRED);
  const onIndexChange = vi.fn();
  render(
    <LoopDeck
      vertical={vertical}
      rtl={rtl}
      pages={pages}
      centred={centred}
      onIndexChange={onIndexChange}
      {...props}
    />
  );
  const root = screen.getByRole('region', { name: 'Test deck' });
  const viewport = viewportOf(root);
  /** Where a box starts, from the viewport's start, the way the deck runs. */
  const startOf = (el: Element) => {
    const [a, b] = [
      el.getBoundingClientRect(),
      viewport.getBoundingClientRect()
    ];
    return vertical ? a.top - b.top : rtl ? b.right - a.right : a.left - b.left;
  };
  return {
    root,
    viewport,
    onIndexChange,
    /** How far the viewport has scrolled from the deck's start. */
    position: () =>
      vertical
        ? viewport.scrollTop
        : rtl
          ? -viewport.scrollLeft
          : viewport.scrollLeft,
    max: () =>
      vertical
        ? viewport.scrollHeight - viewport.clientHeight
        : viewport.scrollWidth - viewport.clientWidth,
    /** A set's length along the axis: from slide 1 to its copy after the
     * slides. */
    length: () =>
      startOf(viewport.querySelector('[data-slidedeck-copy=after]')!) -
      startOf(viewport.querySelector('[data-slidedeck-slide]')!),
    startOf,
    slides: () => (pages ? 10 : 5)
  };
}

/**
 * Each slide and copy in view, from the viewport's start, with its progress:
 * what the deck shows, whichever elements show it.
 */
const shown = (viewport: HTMLElement, startOf: (el: Element) => number) =>
  [...viewport.querySelectorAll<HTMLElement>('[data-in-view]')]
    .map((el) => ({
      slide: el.getAttribute('aria-label'),
      start: Math.round(startOf(el)),
      progress: el.style.getPropertyValue('--deck-slide-progress')
    }))
    .sort((a, b) => a.start - b.start);

/** Where the deck comes to rest after the user's last gesture: on a slide,
 * never a copy, at the viewport's start, and reported if it moved. */
async function expectRest(deck: ReturnType<typeof renderLoop>) {
  const current = () =>
    deck.viewport.querySelector<HTMLElement>('[data-current]')!;
  // Its start, or with centred slides its centre, at the viewport's.
  const offset = () => {
    const el = current();
    const centre = getComputedStyle(el).scrollSnapAlign.includes('center');
    const size = deck.length() / deck.slides();
    // `|| 0`: -0 is not 0 to `toEqual`.
    return (
      Math.round(
        centre ? deck.startOf(el) + size / 2 - WIDTH / 2 : deck.startOf(el)
      ) || 0
    );
  };
  await expectSettledTo(offset, 0);
  expect(current().hasAttribute('data-slidedeck-copy')).toBe(false);
  if (deck.onIndexChange.mock.calls.length > 0) {
    expect(deck.onIndexChange.mock.calls.at(-1)).toEqual([
      Number(deck.root.dataset.index)
    ]);
  }
}

/**
 * Swipes `swipes` times, each pressed as soon as the one before lets go, so
 * the deck never comes to rest between them; returns how far the deck went
 * the way `way` goes, but for jumps of a set, how near it came to either
 * end of the scroll range, and how many times it reported a rest between
 * swipes.
 */
async function chain(
  deck: ReturnType<typeof renderLoop>,
  swipe: () => Promise<unknown>,
  swipes: number,
  way: 1 | -1
) {
  const length = deck.length();
  const max = deck.max();
  let last = deck.position();
  let travel = 0;
  let nearestEnd = Math.min(last, max - last);
  const onScroll = () => {
    const at = deck.position();
    if (Math.abs(at - last) < length / 2) travel += (at - last) * way;
    last = at;
    nearestEnd = Math.min(nearestEnd, at, max - at);
  };
  deck.viewport.addEventListener('scroll', onScroll);
  // Each press, and each pan the browser takes over: where the deck was as it
  // reached the page, and once the deck heard it.
  const presses: number[][] = [];
  const before = () => presses.push([deck.position()]);
  const after = () => presses.at(-1)!.push(deck.position());
  // A mouse shifts as its drag starts, on a move: that move's own write
  // follows the shift.
  const types = ['pointerdown', 'pointercancel', 'pointermove'];
  for (const type of types) {
    window.addEventListener(type, before, { capture: true });
    document.addEventListener(type, after);
  }
  // Reports while a finger or the button is down: a press may land as the
  // deck comes to rest, under load, and that rest is reported; but nothing
  // is reported until the finger lifts.
  let midGesture = 0;
  deck.onIndexChange.mockImplementation(() => {
    if (down) midGesture++;
  });
  for (let i = 0; i < swipes; i++) await swipe();
  deck.viewport.removeEventListener('scroll', onScroll);
  for (const type of types) {
    window.removeEventListener(type, before, { capture: true });
    document.removeEventListener(type, after);
  }
  // How far each press or move that shifted the deck moved it.
  const shifts = presses
    .map(([from, to]) => Math.abs(to - from))
    .filter((d) => d > length / 2);
  return { travel, nearestEnd, midGesture, length, shifts };
}

describe('loop, swipes chained faster than the deck comes to rest', () => {
  beforeEach(parkMouse);

  for (const [name, shape, dx] of [
    ['horizontal', {}, 250],
    ['vertical', { vertical: true }, 150],
    ['right-to-left', { rtl: true }, -250],
    // A set is 3⅓ viewports here: a swipe and its fling stay well within it.
    ['pages', { pages: true }, 150]
  ] as const) {
    for (const way of [1, -1] as const) {
      test(`${name}: touch swipes ${way === 1 ? 'on' : 'back'} carry on round the seam, never to an end`, async () => {
        const deck = renderLoop(shape);
        const axis = 'vertical' in shape ? 'y' : 'x';

        const run = await chain(
          deck,
          () => touchSwipe(deck.viewport, dx * way, { axis }),
          16,
          way
        );

        expect(run.nearestEnd).toBeGreaterThan(1);
        expect(run.travel).toBeGreaterThan(2 * run.length);
        expect(run.midGesture).toBe(0);
        expect(run.shifts).not.toEqual([]);
        for (const d of run.shifts) {
          expect(Math.abs(d - run.length)).toBeLessThanOrEqual(1);
        }
        await expectRest(deck);
      });
    }
  }

  for (const [name, shape, dx] of [
    ['horizontal', {}, -250],
    ['vertical', { vertical: true }, -150],
    ['right-to-left', { rtl: true }, 250],
    ['pages', { pages: true }, -250],
    // As the Loop story: past the last copies' snap points, the scroll range
    // ends off any snap point the deck can rest on. A set is under one and a
    // half viewports: shorter drags, each well within the copies.
    ['centred', { centred: true }, -100]
  ] as const) {
    for (const way of [1, -1] as const) {
      test(`${name}: mouse drags ${way === 1 ? 'on' : 'back'} carry on round the seam, never to an end`, async () => {
        const deck = renderLoop(shape);
        const axis = 'vertical' in shape ? 'y' : 'x';

        // Quick drags: each a flick the deck is still moving on from as the
        // next one presses.
        const run = await chain(
          deck,
          () => mouseDrag(deck.viewport, dx * way, { axis }),
          16,
          way
        );

        expect(run.nearestEnd).toBeGreaterThan(1);
        expect(run.travel).toBeGreaterThan(2 * run.length);
        expect(run.midGesture).toBe(0);
        expect(run.shifts).not.toEqual([]);
        // A set, and the drag's first move: under a 40px step.
        for (const d of run.shifts) {
          expect(Math.abs(d - run.length)).toBeLessThan(40);
        }
        await expectRest(deck);
      });
    }
  }
});

describe('loop, a press on the copies', () => {
  beforeEach(parkMouse);

  /** What a user is told: the index, what was reported, and the live
   * region. */
  const told = (deck: ReturnType<typeof renderLoop>) => ({
    index: deck.root.dataset.index,
    reports: deck.onIndexChange.mock.calls.length,
    live: deck.root.querySelector('[aria-live]')?.textContent
  });

  /** Where focus is as each press reaches the page, and once the deck has
   * heard it: the browser may focus what was pressed after that, the deck
   * never. */
  const watchFocus = () => {
    const seen: [Element | null, Element | null][] = [];
    const before = () => seen.push([document.activeElement, null]);
    const after = () => (seen.at(-1)![1] = document.activeElement);
    window.addEventListener('pointerdown', before, { capture: true });
    document.addEventListener('pointerdown', after);
    onTestFinished(() => {
      window.removeEventListener('pointerdown', before, { capture: true });
      document.removeEventListener('pointerdown', after);
    });
    return seen;
  };

  test('moves the deck a set back onto the slides, and nothing shows or is told', async () => {
    const deck = renderLoop({ defaultIndex: 4 });
    const { viewport, onIndexChange } = deck;
    const box = viewport.getBoundingClientRect();
    // A finger holds the deck part way into the copy of slide 1, after the
    // slides.
    const lift = await touchSwipe(viewport, 400, { release: false });
    let lifted = false;
    onTestFinished(async () => {
      if (!lifted) await lift();
    });
    await expect.poll(() => deck.position()).toBeGreaterThan(3050);
    await sleep(200);
    const at = [deck.position()];
    const seen = [shown(viewport, deck.startOf)];
    const before = told(deck);
    const focus = watchFocus();
    const look = () => at.push(deck.position());
    // Once the deck has heard the press.
    document.addEventListener('pointerdown', look, { once: true });
    onTestFinished(() => document.removeEventListener('pointerdown', look));

    // A pen, as a second finger never reaches the page once the browser
    // pans the first.
    await mouseAt('mousePressed', box.left + 50, box.top + 50, 1, 'pen');

    expect(at).toEqual([at[0], at[0] - 1500]);
    expect(seen[0].map(({ slide }) => slide)).toEqual(['1 of 5', '2 of 5']);
    await nextFrame();
    await nextFrame();
    expect(shown(viewport, deck.startOf)).toEqual(seen[0]);
    expect(deck.position()).toBe(at[1]);
    expect(told(deck)).toEqual(before);
    expect(focus).toHaveLength(1);
    expect(focus[0][1]).toBe(focus[0][0]);

    await mouseAt('mouseReleased', box.left + 50, box.top + 50, 0, 'pen');
    lifted = true;
    await lift();
    await expectRest(deck);
    expect(onIndexChange.mock.calls).toEqual([[0]]);
  });

  test('a tap mid-momentum on the copies tells nothing until the deck rests', async () => {
    const deck = renderLoop({ defaultIndex: 4 });
    const { viewport, onIndexChange } = deck;
    const box = viewport.getBoundingClientRect();
    const finger = { x: box.left + 150, y: box.top + 100, id: 1 };

    await touchSwipe(viewport, 250);
    await expect.poll(() => deck.position()).toBeGreaterThan(2850);
    const before = told(deck);
    const focus = watchFocus();
    await touchAt('touchStart', [finger]);
    await nextFrame();
    expect(told(deck)).toEqual(before);
    await touchAt('touchEnd', []);
    await nextFrame();
    expect(told(deck)).toEqual(before);

    expect(focus).toHaveLength(1);
    expect(focus[0][1]).toBe(focus[0][0]);
    await expectRest(deck);
    expect(onIndexChange.mock.calls).toHaveLength(1);
  });

  for (const [button, from, past, rest] of [
    ['Next', 4, (at: number) => at > 2850, 1],
    ['Previous', 0, (at: number) => at < 1350, 3]
  ] as const) {
    test(`a tap during two ${button}s across the seam leaves the move going to its slide`, async () => {
      const deck = renderLoop({ defaultIndex: from });
      const { viewport, onIndexChange } = deck;
      const at: number[] = [];
      const onScroll = () => at.push(deck.position());
      viewport.addEventListener('scroll', onScroll);
      onTestFinished(() => viewport.removeEventListener('scroll', onScroll));
      const box = viewport.getBoundingClientRect();
      const finger = { x: box.left + 150, y: box.top + 100, id: 1 };

      // Two steps, so the tap comes well before the deck arrives.
      const press = screen.getByRole('button', { name: button });
      press.click();
      press.click();
      await expect.poll(() => past(deck.position())).toBe(true);
      await touchAt('touchStart', [finger]);
      await touchAt('touchEnd', []);

      await expectRest(deck);
      expect(onIndexChange.mock.calls).toEqual([[rest]]);
      // The move went on, undisturbed, to its copy, and jumped off it at
      // rest: the one jump is from the copy's snap point.
      const way = button === 'Next' ? 1 : -1;
      const steps = at.slice(1).map((p, i) => [at[i], (p - at[i]) * way]);
      const jumps = steps.filter(([, d]) => Math.abs(d) > 750);
      expect(jumps.map(([from]) => from % WIDTH)).toEqual([0]);
      expect(steps.filter(([, d]) => d < 0 && d > -750)).toEqual([]);
    });
  }

  test('with click-to-focus, a tap on a copy mid-move brings its slide to focus', async () => {
    const deck = renderLoop({
      centred: true,
      clickToFocus: true,
      defaultIndex: 4
    });
    const { viewport, onIndexChange } = deck;
    await sleep(100);
    const box = viewport.getBoundingClientRect();
    const slide = WIDTH / 3.5;
    // One slide on from the centre, once the deck is over half way to the
    // copy of slide 1, after the slides: the copy of slide 2.
    const finger = {
      x: box.left + WIDTH / 2 + slide,
      y: box.top + 100,
      id: 1
    };

    const start = deck.position();
    screen.getByRole('button', { name: 'Next' }).click();
    await expect
      .poll(() => deck.position())
      .toBeGreaterThan(start + 0.6 * slide);
    await touchAt('touchStart', [finger]);
    await touchAt('touchEnd', []);

    await expectRest(deck);
    expect(deck.root.dataset.index).toBe('1');
    expect(onIndexChange.mock.calls.at(-1)).toEqual([1]);
  });

  test('a finger down as a move arrives on a copy: nothing is reported or jumped under it as it pans', async () => {
    const deck = renderLoop({ defaultIndex: 4 });
    const { viewport, onIndexChange } = deck;
    const box = viewport.getBoundingClientRect();
    const y = box.top + 100;
    const finger = (x: number) => [{ x: box.left + x, y, id: 1 }];
    let lifted = false;
    onTestFinished(async () => {
      if (!lifted) await touchAt('touchEnd', []);
    });

    screen.getByRole('button', { name: 'Next' }).click();
    await touchAt('touchStart', finger(150));
    // The move arrives on the copy of slide 1 and ends, the finger still
    // down: the settle waits for it.
    await expect.poll(() => deck.position()).toBe(3000);
    await sleep(300);
    expect(onIndexChange).not.toHaveBeenCalled();
    // The finger pans: the browser takes it over.
    for (let x = 140; x >= 60; x -= 10) {
      await touchAt('touchMove', finger(x));
      await nextFrame();
    }
    await sleep(300);

    expect(onIndexChange).not.toHaveBeenCalled();
    lifted = true;
    await touchAt('touchEnd', []);
    await expectRest(deck);
    expect(onIndexChange.mock.calls).toHaveLength(1);
  });

  test('a finger whose node leaves the page mid-pan still lets go: the deck settles and reports after the lift', async () => {
    const deck = renderLoop({ defaultIndex: 1 });
    const { onIndexChange } = deck;
    // Content the consumer swaps out mid-pan, under the finger.
    const slide = screen.getByRole('group', { name: '2 of 5' });
    const content = document.createElement('div');
    content.style.height = '100px';
    slide.append(content);
    const box = content.getBoundingClientRect();
    const y = box.top + 50;
    const finger = (x: number) => [{ x, y, id: 1 }];
    let lifted = false;
    onTestFinished(async () => {
      if (!lifted) await touchAt('touchEnd', []);
    });

    const heard: string[] = [];
    content.addEventListener('touchend', () => heard.push('content'));
    content.addEventListener('pointerdown', (e) =>
      heard.push('down ' + (e.target === content))
    );
    // Over half a slide on: the deck moves on a slide once the finger lifts.
    await touchAt('touchStart', finger(box.left + 260));
    for (let x = 250; x >= 40; x -= 10) {
      await touchAt('touchMove', finger(box.left + x));
      if (x === 150) content.remove();
      await nextFrame();
    }
    // Held still, then lifted: the pan's end comes while the finger is down.
    await sleep(300);
    lifted = true;
    await touchAt('touchEnd', []);

    await expectRest(deck);
    expect(onIndexChange.mock.calls).toEqual([[2]]);
  });

  test('a slide resized since the last settle: a press on the copies still shifts by the set as laid out now', async () => {
    const deck = renderLoop({ defaultIndex: 4 });
    const { viewport, onIndexChange } = deck;
    const box = viewport.getBoundingClientRect();
    // A finger holds the deck part way into the copy of slide 1.
    const lift = await touchSwipe(viewport, 400, { release: false });
    let lifted = false;
    onTestFinished(async () => {
      if (!lifted) await lift();
    });
    await expect.poll(() => deck.position()).toBeGreaterThan(3050);
    await sleep(200);
    // Every slide and copy 20px wider, as a font load widens auto-width
    // slides: the viewport keeps its size, and nothing settles.
    addStyle('[data-slidedeck-slide] { min-width: 320px; }');
    await nextFrame();
    await nextFrame();
    // What shows, from layout: the in-view marks wait for a scroll.
    const picture = () =>
      [...viewport.querySelectorAll('[data-slidedeck-slide]')]
        .map((el) => [
          el.getAttribute('aria-label'),
          Math.round(deck.startOf(el))
        ])
        .filter(([, start]) => Number(start) > -320 && Number(start) < WIDTH)
        .sort((a, b) => Number(a[1]) - Number(b[1]));
    const before = picture();
    const at = deck.position();

    await mouseAt('mousePressed', box.left + 50, box.top + 50, 1, 'pen');
    await nextFrame();
    await nextFrame();

    // A set is now 1600px long.
    expect(deck.position()).toBe(at - 1600);
    expect(picture()).toEqual(before);
    expect(onIndexChange).not.toHaveBeenCalled();
    await mouseAt('mouseReleased', box.left + 50, box.top + 50, 0, 'pen');
    lifted = true;
    await lift();
  });

  test('a press reads no layout on the slides, a copy and its slide on the copies, and is quick', async () => {
    // As the Loop story, and more: 24 slides and 48 copies.
    addStyle(
      `.many > * { width: calc(100% / 2.5); scroll-snap-align: center; }`
    );
    const onIndexChange = vi.fn();
    render(
      <TestDeck
        loop
        slides={24}
        viewportClassName="many"
        onIndexChange={onIndexChange}
      />
    );
    const viewport = viewportOf(
      screen.getByRole('region', { name: 'Test deck' })
    );
    await sleep(100);
    const box = viewport.getBoundingClientRect();
    const finger = [{ x: box.left + 150, y: box.top + 20, id: 1 }];
    const times: number[] = [];
    let t0 = 0;
    // Around the deck's own listener: the press reaches the viewport's
    // capture listener first, its own listener next, then this one.
    const start = () => (t0 = performance.now());
    const end = () => times.push(performance.now() - t0);
    viewport.addEventListener('pointerdown', start, { capture: true });
    viewport.addEventListener('pointerdown', end);
    const reads = { boxes: 0 };
    const measure = Element.prototype.getBoundingClientRect;
    onTestFinished(() => {
      Element.prototype.getBoundingClientRect = measure;
      viewport.removeEventListener('pointerdown', start, { capture: true });
      viewport.removeEventListener('pointerdown', end);
    });
    viewport.addEventListener(
      'pointerdown',
      () => {
        Element.prototype.getBoundingClientRect = function (this: Element) {
          reads.boxes++;
          return measure.call(this);
        };
      },
      { capture: true }
    );
    viewport.addEventListener('pointerdown', () => {
      Element.prototype.getBoundingClientRect = measure;
    });

    for (let i = 0; i < 10; i++) {
      await touchAt('touchStart', finger);
      await touchAt('touchEnd', []);
    }

    expect(times).toHaveLength(10);
    expect(reads.boxes).toBe(0);
    expect([...times].sort((a, b) => a - b)[5]).toBeLessThan(1);

    // On the copies, where a finger holds the deck, a pen's press shifts it:
    // it measures the copy, its slide and the viewport, and nothing else.
    const lift = await touchSwipe(viewport, -150, { release: false });
    onTestFinished(async () => {
      await lift();
    });
    await sleep(200);
    const held = viewport.scrollLeft;
    times.length = 0;
    await mouseAt('mousePressed', box.left + 50, box.top + 20, 1, 'pen');
    await mouseAt('mouseReleased', box.left + 50, box.top + 20, 0, 'pen');

    // 24 slides of 120px: a set is 2880px.
    expect(viewport.scrollLeft - held).toBe(2880);
    expect(reads.boxes).toBe(3);
    // The instant scroll is most of it.
    expect(times[0]).toBeLessThan(5);
  });

  test('a mouse click during a wheel scroll on the copies leaves the scroll going', async () => {
    const deck = renderLoop({ defaultIndex: 4 });
    const { viewport } = deck;
    const at: number[] = [];
    const onScroll = () => at.push(deck.position());
    viewport.addEventListener('scroll', onScroll);
    onTestFinished(() => viewport.removeEventListener('scroll', onScroll));
    const box = viewport.getBoundingClientRect();

    const scrolled = gestureScroll(viewport, 900);
    await expect.poll(() => deck.position()).toBeGreaterThan(2850);
    const clicked = at.length;
    await mouseAt('mousePressed', box.left + 50, box.top + 50, 1);
    await mouseAt('mouseReleased', box.left + 50, box.top + 50, 0);
    await scrolled;

    await expectRest(deck);
    // From where the click came, a scroll event at a time: on, but for the
    // jump off a copy at rest, from a snap point. Never a shift from between
    // snap points, and never back.
    const after = at.slice(clicked - 1);
    const steps = after.slice(1).map((p, i) => [after[i], p - after[i]]);
    const jumps = steps.filter(([, d]) => Math.abs(d) > 750);
    expect(jumps.map(([from]) => from % WIDTH)).toEqual(jumps.map(() => 0));
    expect(steps.filter(([, d]) => d < 0 && d > -750)).toEqual([]);
  });
});

// A centred deck's last copies rest past the end of the scroll range, so
// the browser rests them clamped to it, where the engine can neither jump
// off them (their slides a set back rest on no snap point) nor step to them.
// A deck left there re-snaps to a snap point it can rest on, and jumps off
// its copy as usual (#48).
describe('loop, centred, a drag to the end of the scroll range', () => {
  beforeEach(parkMouse);

  for (const [way, from] of [
    ['on', 4],
    ['back', 0]
  ] as const) {
    test(`${way}: comes to rest on a slide`, async () => {
      const deck = renderLoop({ centred: true, defaultIndex: from });
      const { viewport, root, onIndexChange } = deck;
      await sleep(100);

      // Far past the end, held still: no flick.
      await mouseDrag(viewport, way === 'on' ? -1500 : 1500, {
        steps: 20,
        holdMs: 150
      });

      await expectRestOnASlide(viewport, root, onIndexChange);
      expect(deck.position()).toBeGreaterThan(1);
      expect(deck.position()).toBeLessThan(deck.max() - 1);
    });
  }
});
