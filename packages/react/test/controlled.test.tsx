import { createRef, useState, type Ref } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
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

/** A parent that keeps the deck's index in state, as a controlled input's
 * parent keeps its value. */
function ControlledDeck({
  onIndexChange,
  deckRef
}: {
  onIndexChange: (index: number) => void;
  deckRef?: Ref<Deck.RootHandle>;
}) {
  const [index, setIndex] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setIndex(3)}>
        Go to 4
      </button>
      <TestDeck
        ref={deckRef}
        index={index}
        onIndexChange={(next) => {
          onIndexChange(next);
          setIndex(next);
        }}
      />
    </>
  );
}

const renderControlled = () => {
  const ref = createRef<Deck.RootHandle>();
  const onIndexChange = vi.fn();
  render(<ControlledDeck onIndexChange={onIndexChange} deckRef={ref} />);
  const root = screen.getByRole('region', { name: 'Test deck' });
  return { ref, root, viewport: viewportOf(root), onIndexChange };
};

describe('a controlled deck', () => {
  afterEach(() => setReducedMotion(false));

  test('starts at index', () => {
    const { viewport } = renderWithRef({ index: 2 });

    expect(viewport.scrollLeft).toBe(2 * WIDTH);
  });

  test('follows index changes from outside, without calling onIndexChange back', async () => {
    const { root, viewport, onIndexChange } = renderControlled();

    await userEvent.click(screen.getByRole('button', { name: 'Go to 4' }));

    await expectSettledTo(() => viewport.scrollLeft, 3 * WIDTH);
    expect(root.dataset.index).toBe('3');
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  test('reports a user scroll through onIndexChange and stays where the parent puts it', async () => {
    const { viewport, onIndexChange } = renderControlled();

    await userEvent.wheel(viewport, { delta: { x: 200 } });

    await expectSettledTo(() => onIndexChange.mock.calls, [[1]]);
    expect(viewport.scrollLeft).toBe(WIDTH);
  });

  test('returns to index when the parent does not take the new one', async () => {
    const { viewport, onIndexChange } = renderWithRef({ index: 0 });

    await userEvent.wheel(viewport, { delta: { x: 200 } });

    await expect.poll(() => onIndexChange.mock.calls).toEqual([[1]]);
    await expectSettledTo(() => viewport.scrollLeft, 0);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });

  test('the ref moves it and fires onIndexChange for the parent to take', async () => {
    const { ref, viewport, onIndexChange } = renderControlled();

    ref.current!.scrollTo(2);
    await expectSettledTo(() => viewport.scrollLeft, 2 * WIDTH);
    ref.current!.prev();
    await expectSettledTo(() => viewport.scrollLeft, WIDTH);

    expect(onIndexChange.mock.calls).toEqual([[2], [1]]);
  });

  test('goes to index once slides arrive in a deck that had none', async () => {
    const { rerender } = render(<TestDeck slides={0} index={2} />);
    const viewport = viewportOf(
      screen.getByRole('region', { name: 'Test deck' })
    );

    rerender(<TestDeck slides={5} index={2} />);

    await expectSettledTo(() => viewport.scrollLeft, 2 * WIDTH);
  });

  test('with reduced motion, an index change jumps', async () => {
    await setReducedMotion(true);
    const { viewport } = renderControlled();

    act(() => screen.getByRole('button', { name: 'Go to 4' }).click());

    expect(viewport.scrollLeft).toBe(3 * WIDTH);
  });
});

describe('mixing controlled and uncontrolled warns in development', () => {
  const spyOnErrors = () =>
    vi.spyOn(console, 'error').mockImplementation(() => {});
  afterEach(() => vi.restoreAllMocks());

  test('once, when an uncontrolled deck becomes controlled', () => {
    const errors = spyOnErrors();
    const { rerender } = render(<TestDeck />);

    rerender(<TestDeck index={1} onIndexChange={() => {}} />);
    rerender(<TestDeck index={2} onIndexChange={() => {}} />);

    expect(errors).toHaveBeenCalledOnce();
    expect(errors.mock.calls[0][0]).toMatch(
      /uncontrolled deck to be controlled/
    );
  });

  test('once, when a controlled deck becomes uncontrolled', () => {
    const errors = spyOnErrors();
    const { rerender } = render(
      <TestDeck index={1} onIndexChange={() => {}} />
    );

    rerender(<TestDeck />);
    rerender(<TestDeck />);

    expect(errors).toHaveBeenCalledOnce();
    expect(errors.mock.calls[0][0]).toMatch(
      /controlled deck to be uncontrolled/
    );
  });

  test('when given both index and defaultIndex', () => {
    const errors = spyOnErrors();
    const both = { index: 1, defaultIndex: 2, onIndexChange: () => {} };

    render(<TestDeck {...both} />);

    expect(errors).toHaveBeenCalledOnce();
    expect(errors.mock.calls[0][0]).toMatch(
      /either index or defaultIndex, not both/
    );
  });

  test('not at all for a deck that stays one or the other', () => {
    const errors = spyOnErrors();
    const { rerender } = render(<TestDeck defaultIndex={1} />);
    rerender(<TestDeck defaultIndex={2} />);
    render(<TestDeck index={1} onIndexChange={() => {}} />);

    expect(errors).not.toHaveBeenCalled();
  });
});
