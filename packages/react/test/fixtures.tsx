import type { ComponentProps, ReactNode } from 'react';
import { expect } from 'vitest';
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
 * A real mouse drag (CDP mouse events) across `el`: presses near the edge it
 * moves away from, moves `dx` in `steps` moves `stepMs` apart, holds still
 * `holdMs`, releases. Negative `dx` moves the pointer left (up, with `axis:
 * 'y'`), which drags a left-to-right (vertical) deck forward. With `release:
 * false` the button stays down: call the function it returns to let go.
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
  const startX = dx < 0 ? high - 10 : low + 10;
  const buttons = { left: 1, right: 2, middle: 4 }[button];
  const at = (along: number) =>
    axis === 'x' ? toPage(along, across) : toPage(across, along);
  await cdp().send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...at(startX),
    button,
    buttons,
    clickCount: 1
  });
  for (let step = 1; step <= steps; step++) {
    await sleep(stepMs);
    await cdp().send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...at(startX + (dx * step) / steps),
      button,
      buttons
    });
  }
  if (holdMs) await sleep(holdMs);
  const letGo = () =>
    cdp().send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...at(startX + dx),
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
