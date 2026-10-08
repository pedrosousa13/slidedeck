import { render, screen } from '@testing-library/react';
import { expect, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import {
  addStyle,
  expectSettledTo,
  TestDeck,
  viewportOf,
  WIDTH
} from './fixtures';
import { mouse } from './mouse';

// A deck comes to rest where it was going, though the browser renders no
// frame for a while, or scrolls the viewport back during a mouse drag, as
// Playwright's WebKit did under load (#123). These run in WebKit as well as
// Chromium (vitest.config.ts).

const renderDeck = (props: Parameters<typeof TestDeck>[0] = {}) => {
  const onIndexChange = vi.fn();
  render(
    <TestDeck
      onIndexChange={onIndexChange}
      controls={<Deck.Dots />}
      {...props}
    />
  );
  const root = screen.getByRole('region', { name: 'Test deck' });
  return { root, viewport: viewportOf(root), onIndexChange };
};

/** Resolves once the viewport's scroll passes `at`. */
const scrollPast = (viewport: HTMLElement, at: number) =>
  new Promise<void>((resolve) => {
    const past = () => {
      if (viewport.scrollLeft < at) return;
      viewport.removeEventListener('scroll', past);
      resolve();
    };
    viewport.addEventListener('scroll', past);
  });

/**
 * Renders no frame from now until the returned function is called, as
 * WebKit can, measured in Playwright's WebKit under load: for 300ms and
 * more no frame renders while the main thread is idle and timers run, and
 * a scroll in flight goes nowhere and sends no scroll event. Here the
 * scroll is stopped where it is, and no animation frame callback runs.
 * Called, it renders frames again, and, as WebKit does, the scroll goes on
 * to `to`, unless a scroll of the deck's own replaced it meanwhile.
 * Returns whether one did.
 */
function renderNoFrame(viewport: HTMLElement) {
  const { requestAnimationFrame: request, cancelAnimationFrame: cancel } =
    window;
  // Callbacks asked for while no frame renders, by the id handed out.
  const held = new Map<number, FrameRequestCallback>();
  // Each held callback's id once it is asked for again, frames back.
  const asked = new Map<number, number>();
  let next = -1;
  let paused = true;
  window.requestAnimationFrame = (callback) => {
    if (!paused) return request(callback);
    held.set(next, callback);
    return next--;
  };
  window.cancelAnimationFrame = (id) => {
    held.delete(id);
    cancel(asked.get(id) ?? id);
  };
  const scrollTo = vi.spyOn(viewport, 'scrollTo');
  onTestFinished(() => {
    window.requestAnimationFrame = request;
    window.cancelAnimationFrame = cancel;
    scrollTo.mockRestore();
  });
  viewport.scrollBy({ left: 0, top: 0, behavior: 'instant' });
  const stopped = scrollTo.mock.calls.length;
  return (to: { left?: number; top?: number }) => {
    paused = false;
    const replaced = scrollTo.mock.calls.length > stopped;
    if (!replaced) viewport.scrollTo({ ...to, behavior: 'smooth' });
    for (const [id, callback] of held) asked.set(id, request(callback));
    held.clear();
    return replaced;
  };
}

test("a dot's move the browser renders no frame of for a while ends on its target", async () => {
  const { root, viewport, onIndexChange } = renderDeck();

  screen.getByRole('button', { name: 'Go to page 5' }).click();
  await scrollPast(viewport, WIDTH);
  const resume = renderNoFrame(viewport);
  // Longer than two quiets and a re-snap's quiet.
  await new Promise((resolve) => setTimeout(resolve, 500));

  expect(resume({ left: 4 * WIDTH })).toBe(false);
  await expectSettledTo(() => viewport.scrollLeft, 4 * WIDTH);
  expect(root.dataset.index).toBe('4');
  expect(onIndexChange.mock.calls).toEqual([[4]]);
});

test('an arrow key whose scroll ends early, then renders no frame for a while, rests where it goes on to', async () => {
  const { root, viewport, onIndexChange } = renderDeck();

  viewport.focus();
  await userEvent.keyboard('{ArrowRight}');
  await scrollPast(viewport, WIDTH / 4);
  const resume = renderNoFrame(viewport);
  await new Promise((resolve) => setTimeout(resolve, 500));

  expect(resume({ left: WIDTH })).toBe(false);
  await expectSettledTo(() => viewport.scrollLeft, WIDTH);
  expect(root.dataset.index).toBe('1');
  expect(onIndexChange.mock.calls).toEqual([[1]]);
});

test('a mouse drag the browser scrolls back as it goes settles where the pointer took it', async () => {
  // A vertical deck, as a drag's own scroll along the block axis is what
  // the browser scrolled back (see below).
  addStyle(`.tall { height: 400px; }`);
  const { root, viewport } = renderDeck({
    orientation: 'vertical',
    viewportClassName: 'tall'
  });
  const box = viewport.getBoundingClientRect();
  const x = box.left + box.width / 2;

  // Most of a slide up, held still, so the drag places the deck on the
  // next slide rather than flicking it. Measured in Playwright's WebKit
  // under load, the browser scrolls the viewport back toward the start
  // between the drag's moves and before its release, so the deck rested
  // where it began: the scroll the browser makes here.
  await mouse(
    ['move', x, box.bottom - 40],
    ['down'],
    ['move', x, box.bottom - 40 - 0.7 * 400, 12]
  );
  viewport.scrollTo({ top: 0, behavior: 'instant' });
  await mouse(['wait', 100], ['up']);

  await expectSettledTo(() => viewport.scrollTop, 400);
  expect(root.dataset.index).toBe('1');
});
