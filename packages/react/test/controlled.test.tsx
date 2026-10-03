import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type * as Deck from '@slidedeck/react';
import {
  expectSettledTo,
  setReducedMotion,
  TestDeck,
  viewportOf,
  WIDTH
} from './fixtures';

const renderWithRef = (props: Parameters<typeof TestDeck>[0] = {}) => {
  const ref = createRef<Deck.RootHandle>();
  const onIndexChange = vi.fn();
  render(<TestDeck ref={ref} onIndexChange={onIndexChange} {...props} />);
  const root = screen.getByRole('region', { name: 'Test deck' });
  return { ref, viewport: viewportOf(root), onIndexChange };
};

describe('the ref', () => {
  afterEach(() => setReducedMotion(false));

  test('scrollTo moves the deck to a snap point and fires onIndexChange', async () => {
    const { ref, viewport, onIndexChange } = renderWithRef();

    ref.current!.scrollTo(3);

    await expectSettledTo(() => viewport.scrollLeft, 3 * WIDTH);
    expect(onIndexChange.mock.calls).toEqual([[3]]);
  });

  test('next and prev move one snap point and fire onIndexChange', async () => {
    const { ref, viewport, onIndexChange } = renderWithRef();

    ref.current!.next();
    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
    ref.current!.prev();
    await expectSettledTo(() => viewport.scrollLeft, 0);

    expect(onIndexChange.mock.calls).toEqual([[1], [0]]);
  });

  test('quick calls compose: next steps on from a scrollTo still in flight', async () => {
    const { ref, viewport, onIndexChange } = renderWithRef();

    ref.current!.scrollTo(2);
    ref.current!.next();

    await expectSettledTo(() => viewport.scrollLeft, 3 * WIDTH);
    expect(onIndexChange.mock.calls).toEqual([[3]]);
  });

  test('scrollTo clamps to the snap points there are', async () => {
    const { ref, viewport, onIndexChange } = renderWithRef();

    ref.current!.scrollTo(10);

    await expectSettledTo(() => viewport.scrollLeft, 4 * WIDTH);
    expect(onIndexChange.mock.calls).toEqual([[4]]);
  });

  test('with reduced motion, scrollTo jumps', async () => {
    await setReducedMotion(true);
    const { ref, viewport } = renderWithRef();

    ref.current!.scrollTo(2);

    expect(viewport.scrollLeft).toBe(2 * WIDTH);
  });
});
