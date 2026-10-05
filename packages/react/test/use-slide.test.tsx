import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import * as Deck from '@slidedeck/react';
import { viewportOf, WIDTH } from './fixtures';

// Deck.useSlide: which slide a slide's content is in, and whether it is a
// loop's copy of it, so stateful content such as a video player can render
// differently in a copy.

/** Writes what useSlide reports where a test can read it. */
function Probe() {
  const { index, copy } = Deck.useSlide();
  return (
    <span data-index={index} data-copy={copy ?? 'none'}>
      Slide {index + 1}
    </span>
  );
}

test('useSlide reports the index in each slide and the side in each copy', () => {
  render(
    <Deck.Root aria-label="Test deck" loop>
      <Deck.Viewport style={{ width: WIDTH }}>
        {Array.from({ length: 3 }, (_, i) => (
          <Deck.Slide key={i}>
            <Probe />
          </Deck.Slide>
        ))}
      </Deck.Viewport>
    </Deck.Root>
  );
  const viewport = viewportOf(
    screen.getByRole('region', { name: 'Test deck' })
  );

  const reported = (selector: string) =>
    [...viewport.querySelectorAll<HTMLElement>(selector)].map((slide) => {
      const probe = slide.querySelector<HTMLElement>('[data-index]')!;
      return [Number(probe.dataset.index), probe.dataset.copy];
    });

  expect(reported('[data-slidedeck-slide]:not([data-slidedeck-copy])')).toEqual(
    [
      [0, 'none'],
      [1, 'none'],
      [2, 'none']
    ]
  );
  expect(reported('[data-slidedeck-copy=after]')).toEqual([
    [0, 'after'],
    [1, 'after'],
    [2, 'after']
  ]);
  expect(reported('[data-slidedeck-copy=before]')).toEqual([
    [0, 'before'],
    [1, 'before'],
    [2, 'before']
  ]);
});

test('useSlide outside a slide names the missing primitive', () => {
  // React logs the error it rethrows; keep the run's output readable.
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(() =>
      render(
        <Deck.Root aria-label="Stray">
          <Probe />
          <Deck.Viewport />
        </Deck.Root>
      )
    ).toThrow('Deck.useSlide must be inside Deck.Slide');
  } finally {
    spy.mockRestore();
  }
});
