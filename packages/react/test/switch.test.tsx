import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import * as Deck from '@slidedeck/react';
import { curve } from '@slidedeck/react/curve';
import { fade } from '@slidedeck/react/fade';
import { addStyle, expectSettledTo, viewportOf, WIDTH } from './fixtures';

// An app that picks `effect` or `loop` by breakpoint, as from a media query,
// switches them on a mounted deck. Loop's copies, or fade's stacked slides
// over snap targets, move the snap points under the viewport: the deck stays
// at its current index, as if it had mounted that way.

const SLIDES = 6;

type Layout = { effect?: Deck.Effect; loop?: boolean };

type SwitchDeckProps = ComponentProps<typeof Deck.Root> & Layout;

/** Two slides in view, 50% wide, unless an effect stacks them. */
function SwitchDeck({ effect, ...props }: SwitchDeckProps) {
  return (
    <Deck.Root aria-label="Test deck" {...props}>
      <Deck.Viewport
        effect={effect}
        className="half"
        style={{ width: WIDTH, height: 100 }}
      >
        {Array.from({ length: SLIDES }, (_, i) => (
          <Deck.Slide key={i}>
            <button type="button">Button {i + 1}</button>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
      <Deck.Next />
    </Deck.Root>
  );
}

const renderSwitch = (defaultIndex: number, layout: Layout = {}) => {
  addStyle('.half > [data-slidedeck-slide] { width: 50%; }');
  const onIndexChange = vi.fn();
  const { rerender } = render(
    <SwitchDeck
      defaultIndex={defaultIndex}
      onIndexChange={onIndexChange}
      {...layout}
    />
  );
  const root = screen.getByRole('region', { name: 'Test deck' });
  const viewport = viewportOf(root);
  return {
    root,
    viewport,
    onIndexChange,
    next: screen.getByRole('button', { name: 'Next' }),
    switchTo: (next: Layout) =>
      rerender(
        <SwitchDeck
          defaultIndex={defaultIndex}
          onIndexChange={onIndexChange}
          {...next}
        />
      ),
    live: () => root.querySelector('[data-slidedeck-live]')?.textContent
  };
};

/**
 * Where the deck rests, as `[index, current slide, offset]`: the offset is
 * from the viewport's start to the box slide `index` snaps by, its own or,
 * where an effect stacks the slides, its snap target. 0 when the deck rests
 * on the snap point of that slide, a slide, never a copy.
 */
const restOf = (root: HTMLElement, viewport: HTMLElement, index: number) => {
  const targets = viewport.querySelectorAll(
    ':scope > [data-slidedeck-snap-target]'
  );
  const before = viewport.querySelectorAll(
    ':scope > [data-slidedeck-copy=before]'
  ).length;
  const box =
    targets.length > 0
      ? targets[before + index]
      : viewport.querySelectorAll(
          ':scope > [data-slidedeck-slide]:not([data-slidedeck-copy])'
        )[index];
  const current = root.querySelector('[data-current]');
  return [
    root.dataset.index,
    current?.hasAttribute('data-slidedeck-copy')
      ? 'a copy'
      : current?.getAttribute('aria-label'),
    Math.round(
      box.getBoundingClientRect().left - viewport.getBoundingClientRect().left
    )
  ];
};

describe('switching effect or loop on a mounted deck', () => {
  test.each([1, 3])(
    'keeps the deck at rest at index %i, from none to fade, curve and none',
    async (index) => {
      const { root, viewport, onIndexChange, switchTo, live } =
        renderSwitch(index);
      const rest = () => restOf(root, viewport, index);
      const at = [String(index), `${index + 1} of ${SLIDES}`, 0];
      expect(rest()).toEqual(at);

      for (const effect of [fade, curve, undefined]) {
        switchTo({ effect });
        // Before the browser paints the new layout.
        expect(rest()).toEqual(at);
        await expectSettledTo(rest, at);
      }

      expect(onIndexChange).not.toHaveBeenCalled();
      expect(live()).toBe('');
    }
  );

  test.each([1, 3])(
    'keeps the deck at rest at index %i as loop turns on and off, with each effect',
    async (index) => {
      const { root, viewport, onIndexChange, switchTo, live } =
        renderSwitch(index);
      const rest = () => restOf(root, viewport, index);
      const at = [String(index), `${index + 1} of ${SLIDES}`, 0];

      for (const layout of [
        { loop: true },
        { loop: false },
        { effect: fade },
        { effect: fade, loop: true },
        { effect: fade },
        { effect: curve, loop: true },
        { effect: curve }
      ]) {
        switchTo(layout);
        expect(rest()).toEqual(at);
        await expectSettledTo(rest, at);
      }

      expect(onIndexChange).not.toHaveBeenCalled();
      expect(live()).toBe('');
    }
  );

  test.each([1, 3])(
    'keeps the deck at rest at index %i when effect and loop switch together',
    async (index) => {
      const { root, viewport, onIndexChange, switchTo, live } = renderSwitch(
        index,
        { loop: true }
      );
      const rest = () => restOf(root, viewport, index);
      const at = [String(index), `${index + 1} of ${SLIDES}`, 0];

      for (const layout of [
        { effect: fade },
        { loop: true },
        { effect: curve },
        { effect: fade, loop: true },
        { loop: true }
      ]) {
        switchTo(layout);
        expect(rest()).toEqual(at);
        await expectSettledTo(rest, at);
      }

      expect(onIndexChange).not.toHaveBeenCalled();
      expect(live()).toBe('');
    }
  );

  test('with a move in flight, the deck ends at the move’s target', async () => {
    const { root, viewport, onIndexChange, next, switchTo } = renderSwitch(1);

    // Next starts a move; the switch comes in the same task, before it ends.
    next.click();
    switchTo({ effect: fade, loop: true });

    await expectSettledTo(
      () => restOf(root, viewport, 2),
      ['2', `3 of ${SLIDES}`, 0]
    );
    expect(onIndexChange.mock.calls).toEqual([[2]]);
  });

  test('turned off with a move across the seam in flight, the deck ends on the slide the move went to', async () => {
    const { root, viewport, onIndexChange, next, switchTo } = renderSwitch(5, {
      loop: true
    });

    // Next from the last slide heads for the first slide's copy after them.
    next.click();
    switchTo({ effect: fade });

    await expectSettledTo(
      () => restOf(root, viewport, 0),
      ['0', `1 of ${SLIDES}`, 0]
    );
    expect(onIndexChange.mock.calls).toEqual([[0]]);
  });
});
