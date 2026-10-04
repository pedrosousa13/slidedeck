import { useState, type ComponentProps } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import * as Deck from '@slidedeck/react';
import {
  expectSettledTo,
  mouseDrag,
  setReducedMotion,
  sleep,
  TestDeck,
  touchSwipe,
  viewportOf,
  WIDTH
} from './fixtures';

const renderDeck = (props: Parameters<typeof TestDeck>[0] = {}) => {
  const onIndexChange = vi.fn();
  render(<TestDeck onIndexChange={onIndexChange} {...props} />);
  const root = screen.getByRole('region', { name: 'Test deck' });
  return { root, viewport: viewportOf(root), onIndexChange };
};

/** A slow drag: held still before release, so it carries no flick. */
const slowly = { steps: 10, stepMs: 20, holdMs: 120 };

describe('a mouse drag', () => {
  afterEach(() => setReducedMotion(false));

  test('moves the deck with the pointer, with snapping off', async () => {
    const { viewport } = renderDeck();

    const letGo = await mouseDrag(viewport, -100, {
      ...slowly,
      release: false
    });
    await sleep(300);

    expect(viewport.scrollLeft).toBe(100);
    await letGo();
  });

  test('past half a slide settles on the next snap point and reports it once', async () => {
    const { root, viewport, onIndexChange } = renderDeck();

    await mouseDrag(viewport, -200, slowly);

    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
    expect(root.dataset.index).toBe('1');
  });

  test('short of half a slide settles back where it was, silently', async () => {
    const { viewport, onIndexChange } = renderDeck();

    await mouseDrag(viewport, -80, slowly);

    await expectSettledTo(() => viewport.scrollLeft, 0);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  test('a flick moves on a snap point though it is short', async () => {
    const { viewport, onIndexChange } = renderDeck();

    await mouseDrag(viewport, -60, { steps: 4, stepMs: 10 });

    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });

  test('turns snapping back on once it settles', async () => {
    const { viewport } = renderDeck();
    const snapType = viewport.style.scrollSnapType;

    await mouseDrag(viewport, -200, slowly);

    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
    expect(viewport.style.scrollSnapType).toBe(snapType);
  });

  test('reports nothing while the button is down', async () => {
    const { viewport, onIndexChange } = renderDeck();

    const letGo = await mouseDrag(viewport, -250, {
      ...slowly,
      release: false
    });
    await sleep(400);

    expect(onIndexChange).not.toHaveBeenCalled();
    await letGo();
    await expectSettledTo(() => onIndexChange.mock.calls, [[1]]);
  });

  test('with reduced motion, settles on its snap point at once', async () => {
    await setReducedMotion(true);
    const { viewport, onIndexChange } = renderDeck();
    const snapType = viewport.style.scrollSnapType;

    await mouseDrag(viewport, -200, slowly);

    expect(viewport.scrollLeft).toBe(WIDTH);
    await expectSettledTo(() => onIndexChange.mock.calls, [[1]]);
    expect(viewport.style.scrollSnapType).toBe(snapType);
  });

  test('takes over a scroll in flight, which then never reports', async () => {
    const { viewport, onIndexChange } = renderDeck();
    const snapType = viewport.style.scrollSnapType;

    // Next heads for snap point 1; the drag pulls the deck back to 0.
    act(() => screen.getByRole('button', { name: 'Next' }).click());
    await mouseDrag(viewport, 250, slowly);

    await expectSettledTo(() => viewport.scrollLeft, 0);
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(viewport.style.scrollSnapType).toBe(snapType);
    // Next steps from where the deck rests, not from the abandoned target.
    act(() => screen.getByRole('button', { name: 'Next' }).click());
    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });

  test('takes over its own release mid-flight', async () => {
    const { viewport, onIndexChange } = renderDeck();
    const snapType = viewport.style.scrollSnapType;

    // A flick heads for snap point 1; a second drag catches it on the way
    // and pulls it back.
    await mouseDrag(viewport, -60, { steps: 4, stepMs: 10 });
    await mouseDrag(viewport, 250, slowly);

    await expectSettledTo(() => viewport.scrollLeft, 0);
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(viewport.style.scrollSnapType).toBe(snapType);
  });

  test('in a controlled deck, reports the new index and returns to index if the parent does not take it', async () => {
    const { viewport, onIndexChange } = renderDeck({ index: 0 });

    await mouseDrag(viewport, -200, slowly);

    await expect.poll(() => onIndexChange.mock.calls).toEqual([[1]]);
    await expectSettledTo(() => viewport.scrollLeft, 0);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });

  test('in a controlled deck, stays where it settles when the parent takes it', async () => {
    const onIndexChange = vi.fn();
    function Parent() {
      const [index, setIndex] = useState(0);
      return (
        <TestDeck
          index={index}
          onIndexChange={(next) => {
            onIndexChange(next);
            setIndex(next);
          }}
        />
      );
    }
    render(<Parent />);
    const viewport = viewportOf(
      screen.getByRole('region', { name: 'Test deck' })
    );

    await mouseDrag(viewport, -200, slowly);

    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });

  test('in a controlled deck, goes to an index the parent sets mid-drag once it lets go', async () => {
    const onIndexChange = vi.fn();
    let setIndex: (index: number) => void = () => {};
    function Parent() {
      const [index, set] = useState(0);
      setIndex = set;
      return (
        <TestDeck
          index={index}
          onIndexChange={(next) => {
            onIndexChange(next);
            set(next);
          }}
        />
      );
    }
    render(<Parent />);
    const viewport = viewportOf(
      screen.getByRole('region', { name: 'Test deck' })
    );

    const letGo = await mouseDrag(viewport, -60, {
      ...slowly,
      release: false
    });
    act(() => setIndex(3));
    await sleep(100);
    expect(viewport.scrollLeft).toBe(60);
    await letGo();

    await expectSettledTo(() => viewport.scrollLeft, 3 * WIDTH);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  test('with a button other than the primary one does nothing', async () => {
    const { viewport, onIndexChange } = renderDeck();

    await mouseDrag(viewport, -200, { ...slowly, button: 'middle' });
    await sleep(300);

    expect(viewport.scrollLeft).toBe(0);
    expect(onIndexChange).not.toHaveBeenCalled();
  });
});

describe('a touch swipe', () => {
  test('is left to the browser: snapping stays on', async () => {
    const { viewport, onIndexChange } = renderDeck();
    const snapTypes = new Set<string>();
    const record = () => snapTypes.add(viewport.style.scrollSnapType);
    viewport.addEventListener('scroll', record);

    await touchSwipe(viewport, 200);

    await expectSettledTo(() => onIndexChange.mock.calls, [[1]]);
    expect([...snapTypes]).toEqual([viewport.style.scrollSnapType]);
    viewport.removeEventListener('scroll', record);
  });
});

/** A deck whose slides are links, each counting its clicks. */
function renderLinkDeck(props: ComponentProps<typeof Deck.Root> = {}) {
  const onLinkClick = vi.fn();
  render(
    <Deck.Root aria-label="Test deck" {...props}>
      <Deck.Viewport style={{ width: WIDTH }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Deck.Slide key={i}>
            <a
              href={`#link-${i + 1}`}
              style={{ display: 'block', height: 100 }}
              onClick={(event) => {
                event.preventDefault();
                onLinkClick(i + 1);
              }}
            >
              Link {i + 1}
            </a>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
    </Deck.Root>
  );
  const viewport = viewportOf(
    screen.getByRole('region', { name: 'Test deck' })
  );
  return {
    viewport,
    link: screen.getByRole('link', { name: 'Link 1' }),
    onLinkClick
  };
}

describe('a link inside a slide', () => {
  test('does not fire its click at the end of a drag that starts on it', async () => {
    const { link, viewport, onLinkClick } = renderLinkDeck();

    await mouseDrag(link, -200, slowly);

    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
    expect(onLinkClick).not.toHaveBeenCalled();
  });

  test('fires no click on the deck either', async () => {
    const onDeckClick = vi.fn();
    const { link } = renderLinkDeck({ onClick: onDeckClick });

    await mouseDrag(link, -200, slowly);
    await sleep(300);

    expect(onDeckClick).not.toHaveBeenCalled();
  });

  test('still fires its click on a plain click', async () => {
    const { link, onLinkClick } = renderLinkDeck();

    await mouseDrag(link, 0, { steps: 0 });

    expect(onLinkClick.mock.calls).toEqual([[1]]);
  });

  test('still fires its click after a press that wobbles under the drag threshold', async () => {
    const { link, onLinkClick } = renderLinkDeck();

    await mouseDrag(link, -3, { steps: 3 });

    expect(onLinkClick.mock.calls).toEqual([[1]]);
  });

  test('fires the next click after a drag', async () => {
    const { link, onLinkClick } = renderLinkDeck();
    await mouseDrag(link, -80, slowly);
    await sleep(500);

    await mouseDrag(link, 0, { steps: 0 });

    expect(onLinkClick.mock.calls).toEqual([[1]]);
  });
});

describe('with drag={false}', () => {
  test('a mouse drag does not move the deck', async () => {
    const { viewport, link } = renderLinkDeck({ drag: false });

    await mouseDrag(link, -200, slowly);
    await sleep(300);

    expect(viewport.scrollLeft).toBe(0);
  });

  test('drag can be turned off after mount, and back on', async () => {
    const { rerender } = render(<TestDeck />);
    const viewport = viewportOf(
      screen.getByRole('region', { name: 'Test deck' })
    );

    rerender(<TestDeck drag={false} />);
    await mouseDrag(viewport, -200, slowly);
    await sleep(300);
    expect(viewport.scrollLeft).toBe(0);

    rerender(<TestDeck drag />);
    await mouseDrag(viewport, -200, slowly);
    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
  });
});
