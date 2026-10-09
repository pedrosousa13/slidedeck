import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  expectRestOnASlide,
  mouseDrag,
  nextFrame,
  parkMouse,
  sleep,
  TestDeck,
  trackMotion,
  viewportOf,
  WIDTH
} from './fixtures';
import { DELAYS, SWEEP_MS } from './arrival-helpers';

// Moves as the deck arrives, before its scroll ends (#41): see
// arrival-helpers.tsx for the sweep of delays these tests share.

beforeEach(parkMouse);

describe("the user's own scroll as the deck arrives", () => {
  // The user's scroll ends the deck's move: the deck rests where the user
  // leaves it, nothing moves it on afterwards, and a press then steps from
  // there.
  async function atEveryDelay(
    props: Parameters<typeof TestDeck>[0],
    scroll: (viewport: HTMLElement) => Promise<unknown>
  ) {
    for (const delay of DELAYS) {
      const onIndexChange = vi.fn();
      const { unmount } = render(
        <TestDeck onIndexChange={onIndexChange} {...props} />
      );
      const root = screen.getByRole('region', { name: 'Test deck' });
      const viewport = viewportOf(root);
      const next = screen.getByRole('button', { name: 'Next' });

      next.click();
      await sleep(delay);
      await scroll(viewport);
      // From a frame after the user's scroll, nothing moves the deck on.
      await nextFrame();
      const motion = trackMotion(viewport);

      await expectRestOnASlide(viewport, root, onIndexChange);
      expect({ delay, against: motion.against(-1, 2.5 * WIDTH) }).toEqual({
        delay,
        against: []
      });
      const rest = Number(root.dataset.index);
      next.click();
      await expectRestOnASlide(viewport, root, onIndexChange);
      expect({ delay, index: root.dataset.index }).toEqual({
        delay,
        index: String((rest + 1) % 5)
      });
      unmount();
    }
  }

  const wheelBack = (viewport: HTMLElement) =>
    userEvent.wheel(viewport, { delta: { x: -200 } });
  const keyBack = (viewport: HTMLElement) => {
    viewport.focus();
    return userEvent.keyboard('{ArrowLeft}');
  };
  const dragBack = (viewport: HTMLElement) => mouseDrag(viewport, 150);

  test(
    'a wheel back',
    async () => {
      await atEveryDelay({ defaultIndex: 1 }, wheelBack);
    },
    SWEEP_MS
  );

  test(
    'a wheel back, looping',
    async () => {
      await atEveryDelay({ loop: true, defaultIndex: 4 }, wheelBack);
    },
    SWEEP_MS
  );

  test(
    'an arrow key back',
    async () => {
      await atEveryDelay({ defaultIndex: 1 }, keyBack);
    },
    SWEEP_MS
  );

  test(
    'a mouse drag back, looping',
    async () => {
      await atEveryDelay({ loop: true, defaultIndex: 4 }, dragBack);
    },
    SWEEP_MS
  );
});
