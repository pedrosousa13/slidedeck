import type { ComponentProps, ReactNode } from 'react';
import {
  afterEach,
  beforeEach,
  expect,
  onTestFinished,
  type Mock
} from 'vitest';
import { cdp } from 'vitest/browser';
import * as Deck from '@slidedeck/react';

/** Viewport width every fixture deck uses, so snap points are predictable. */
export const WIDTH = 300;

type TestDeckProps = ComponentProps<typeof Deck.Root> & {
  slides?: number;
  viewportClassName?: string;
  /** Rendered after Next, as more of the deck's controls. */
  controls?: ReactNode;
};

/** A deck with no stylesheet: only the consumer's viewport width. */
export function TestDeck({
  slides = 5,
  viewportClassName,
  controls,
  ...props
}: TestDeckProps) {
  return (
    <Deck.Root aria-label="Test deck" {...props}>
      <Deck.Prev />
      <Deck.Viewport className={viewportClassName} style={{ width: WIDTH }}>
        {Array.from({ length: slides }, (_, i) => (
          <Deck.Slide key={i}>
            <button type="button">Button {i + 1}</button>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
      <Deck.Next />
      {controls}
    </Deck.Root>
  );
}

/** Adds consumer CSS to the document for the rest of the current test. */
export function addStyle(css: string) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  onTestFinished(() => style.remove());
}

/** Slides 3.5 to the viewport, centred: apply with class `centred`. */
export const CENTRED = `.centred > * { width: calc(100% / 3.5); scroll-snap-align: center; }`;

// A page is a group of slides that snap together (CONTEXT.md). Geometry is
// consumer CSS (ADR-0003), so paging is too: only the first slide of each
// page is a snap target. Both rules have the same specificity, so a later
// page size, as in a media query, overrides every slide's alignment.
export const pagesOf = (size: number, selector = '.pages') => `
  ${selector} > [data-slidedeck-slide]:nth-child(${size}n + 1) {
    scroll-snap-align: start;
  }
  ${selector} > [data-slidedeck-slide]:not(:nth-child(${size}n + 1)) {
    scroll-snap-align: none;
  }
`;

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));

/**
 * Waits until `read()` equals `expected`, then a while longer, and checks it
 * still does: proves "exactly this", not "this so far".
 */
export async function expectSettledTo<T>(read: () => T, expected: T) {
  await expect.poll(read, { timeout: 3000 }).toEqual(expected);
  await sleep(400);
  expect(read()).toEqual(expected);
}

export const viewportOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-slidedeck-viewport]')!;

/** Each slide's `--deck-progress`, as the engine last wrote it. */
export const progressOf = (viewport: HTMLElement) =>
  [
    ...viewport.querySelectorAll<HTMLElement>(':scope > [data-slidedeck-slide]')
  ].map((slide) => Number(slide.style.getPropertyValue('--deck-progress')));

/** CDP takes coordinates in the top page; vitest scales the test iframe. */
function toPage(x: number, y: number) {
  const frame = window.frameElement!.getBoundingClientRect();
  const scale = frame.width / window.innerWidth;
  return { x: frame.x + x * scale, y: frame.y + y * scale };
}

/** A real touch swipe (CDP touch events); positive `dx` moves the finger left. */
export async function touchSwipe(el: Element, dx: number) {
  const box = el.getBoundingClientRect();
  const y = box.top + box.height / 2;
  const startX = box.left + box.width * 0.75;
  const at = (t: number) => [{ ...toPage(startX - dx * t, y), id: 1 }];
  await cdp().send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: at(0)
  });
  for (let step = 1; step <= 6; step++) {
    await sleep(16);
    await cdp().send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: at(step / 6)
    });
  }
  await cdp().send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: []
  });
}

/**
 * A real mouse drag (CDP mouse events) across `el` along `axis`: presses 10px
 * inside the edge the pointer moves away from, moves `dx` in `steps` moves
 * `stepMs` apart, holds still `holdMs`, releases. Negative `dx` moves the
 * pointer left, or up with `axis: 'y'`: that drags a left-to-right deck, or a
 * vertical one, forward. With `release: false` the button stays down: call the
 * function it returns to let go.
 */
export async function mouseDrag(
  el: Element,
  dx: number,
  {
    steps = 10,
    stepMs = 16,
    holdMs = 0,
    button = 'left',
    release = true,
    axis = 'x'
  }: {
    steps?: number;
    stepMs?: number;
    holdMs?: number;
    button?: 'left' | 'middle' | 'right';
    release?: boolean;
    axis?: 'x' | 'y';
  } = {}
): Promise<() => Promise<unknown>> {
  const box = el.getBoundingClientRect();
  const [low, high, across] =
    axis === 'x'
      ? [box.left, box.right, box.top + box.height / 2]
      : [box.top, box.bottom, box.left + box.width / 2];
  const start = dx < 0 ? high - 10 : low + 10;
  const buttons = { left: 1, right: 2, middle: 4 }[button];
  const at = (along: number) =>
    axis === 'x' ? toPage(along, across) : toPage(across, along);
  await cdp().send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...at(start),
    button,
    buttons,
    clickCount: 1
  });
  for (let step = 1; step <= steps; step++) {
    await sleep(stepMs);
    await cdp().send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...at(start + (dx * step) / steps),
      button,
      buttons
    });
  }
  if (holdMs) await sleep(holdMs);
  const letGo = () =>
    cdp().send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...at(start + dx),
      button,
      buttons: 0,
      clickCount: 1
    });
  if (release) await letGo();
  return letGo;
}

/** One real mouse event (CDP) at `x`, `y` in this page, with `buttons` held:
 * 1 for the primary button, 0 for none. */
export const mouseAt = (
  type: 'mousePressed' | 'mouseMoved' | 'mouseReleased',
  x: number,
  y: number,
  buttons: number
): Promise<unknown> =>
  cdp().send('Input.dispatchMouseEvent', {
    type,
    ...toPage(x, y),
    button: buttons || type !== 'mouseMoved' ? 'left' : 'none',
    buttons,
    clickCount: 1
  });

/**
 * Moves the mouse to the page's bottom-left corner, off any deck. The pointer
 * rests wherever the last test left it, and Chromium fires `pointerenter` on a
 * deck rendered under a resting cursor: a pointer over a deck pauses its
 * autoplay.
 */
export const parkMouse = () =>
  mouseAt('mouseMoved', 5, window.innerHeight - 5, 0);

/**
 * Checks the deck snaps, as a user sees it: a native scroll that stops just
 * past where the deck rests comes back to rest there.
 */
export async function expectSnaps(
  viewport: HTMLElement,
  axis: 'scrollLeft' | 'scrollTop' = 'scrollLeft'
) {
  const rest = viewport[axis];
  viewport[axis] = rest + 40;
  // At the end of the range that way: go the other way instead.
  if (viewport[axis] === rest) viewport[axis] = rest - 40;
  await expectSettledTo(() => viewport[axis], rest);
}

/** A smooth two-finger-style scroll gesture, synthesised by Chromium. */
export async function gestureScroll(el: Element, dx: number) {
  const box = el.getBoundingClientRect();
  await cdp().send('Input.synthesizeScrollGesture', {
    ...toPage(box.left + box.width / 2, box.top + box.height / 2),
    xDistance: -dx,
    yDistance: 0,
    gestureSourceType: 'mouse'
  });
}

export async function setReducedMotion(reduce: boolean) {
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : '' }
    ]
  });
}

/** Chromium's forced colours mode, as Windows High Contrast turns it on. */
export async function setForcedColors(active: boolean) {
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'forced-colors', value: active ? 'active' : '' }]
  });
}

/** Samples the viewport's scroll position every frame until `against` is
 * read. */
export function trackMotion(viewport: HTMLElement) {
  const positions: number[] = [];
  let done = false;
  const sample = () => {
    positions.push(viewport.scrollLeft);
    if (!done) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  return {
    /** Every frame's move against `way` (1 on, -1 back), but for a jump of
     * at least `jump` px off a copy. */
    against(way: 1 | -1, jump: number) {
      done = true;
      return positions
        .slice(1)
        .map((at, i) => (at - positions[i]) * way)
        .filter((d) => Math.abs(d) < jump && d < -1);
    }
  };
}

/**
 * Waits for the deck to stop moving, then checks it rests as a deck should:
 * on a slide's snap point (the current slide, never a copy, at the snap
 * alignment point), with snapping back on, and, if it reported a move, the
 * page it shows, of `pageSize` slides.
 */
export async function expectRestOnASlide(
  viewport: HTMLElement,
  root: HTMLElement,
  onIndexChange: Mock,
  pageSize = 1
) {
  let last = NaN;
  await expect
    .poll(
      async () => {
        const at = viewport.scrollLeft;
        await sleep(300);
        const still = at === last && at === viewport.scrollLeft;
        last = viewport.scrollLeft;
        return still;
      },
      { timeout: 8000 }
    )
    .toBe(true);
  expect(viewport.style.scrollSnapType).not.toBe('none');
  const current = viewport.querySelector<HTMLElement>('[data-current]')!;
  expect(current.hasAttribute('data-slidedeck-copy')).toBe(false);
  const box = current.getBoundingClientRect();
  const view = viewport.getBoundingClientRect();
  const centre = getComputedStyle(current).scrollSnapAlign.includes('center');
  expect(
    Math.abs(
      centre
        ? (box.left + box.right) / 2 - (view.left + view.right) / 2
        : box.left - view.left
    )
  ).toBeLessThan(1);
  const shown = String(
    Math.floor(
      (Number(current.getAttribute('aria-label')!.split(' ')[0]) - 1) / pageSize
    )
  );
  expect(root.dataset.index).toBe(shown);
  if (onIndexChange.mock.calls.length > 0) {
    expect(onIndexChange.mock.calls.at(-1)).toEqual([Number(shown)]);
  }
}

/**
 * Called in a describe block, makes each of its tests run in an engine
 * without `scrollend`: Chromium with `scrollend` undetectable and neither it
 * nor `scrollsnapchange` reaching the deck, as in Safari before 26.
 */
export function withoutScrollEnd() {
  const block = (event: Event) => event.stopImmediatePropagation();
  let restore = () => {};
  beforeEach(() => {
    const hosts = [window, Document.prototype, HTMLElement.prototype].filter(
      (host) => Object.hasOwn(host, 'onscrollend')
    );
    const saved = hosts.map((host) =>
      Object.getOwnPropertyDescriptor(host, 'onscrollend')!
    );
    hosts.forEach((host) => delete (host as Partial<Window>).onscrollend);
    window.addEventListener('scrollend', block, true);
    window.addEventListener('scrollsnapchange', block, true);
    restore = () => {
      hosts.forEach((host, i) =>
        Object.defineProperty(host, 'onscrollend', saved[i])
      );
      window.removeEventListener('scrollend', block, true);
      window.removeEventListener('scrollsnapchange', block, true);
    };
  });
  afterEach(() => restore());
}
