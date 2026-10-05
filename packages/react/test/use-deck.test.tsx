import { Profiler, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import {
  addStyle,
  expectSettledTo,
  pagesOf,
  parkMouse,
  sleep,
  TestDeck,
  viewportOf,
  WIDTH
} from './fixtures';

// Deck.useDeck: the deck's state and moves, read from Root, so a consumer can
// build Prev, Next, a counter or pagination from their own components.

/** Writes what useDeck reports where a test can read it. */
function Probe() {
  const { index, count, loop, fits, canPrev, canNext } = Deck.useDeck();
  return (
    <span
      data-probe=""
      data-index={index}
      data-count={count ?? 'null'}
      data-loop={loop}
      data-fits={fits}
      data-can-prev={canPrev}
      data-can-next={canNext}
    />
  );
}

const probed = () => {
  const probe = document.querySelector<HTMLElement>('[data-probe]')!.dataset;
  return {
    index: Number(probe.index),
    count: probe.count === 'null' ? null : Number(probe.count),
    loop: probe.loop === 'true',
    fits: probe.fits === 'true',
    canPrev: probe.canPrev === 'true',
    canNext: probe.canNext === 'true'
  };
};

/** What the built-in controls show of the same state. */
const builtIns = () => {
  const prev = document.querySelector<HTMLButtonElement>(
    '[data-slidedeck-prev]'
  );
  const next = document.querySelector<HTMLButtonElement>(
    '[data-slidedeck-next]'
  );
  const counter = document.querySelector<HTMLElement>(
    '[data-slidedeck-counter]'
  );
  return {
    fits: prev === null && next === null && counter === null,
    canPrev: prev !== null && !prev.disabled,
    canNext: next !== null && !next.disabled,
    index: counter && Number(counter.dataset.index),
    count: counter && Number(counter.dataset.count)
  };
};

const renderDeck = (props: Parameters<typeof TestDeck>[0] = {}) =>
  render(
    <TestDeck
      controls={
        <>
          <Deck.Counter />
          <Probe />
        </>
      }
      {...props}
    />
  );

describe('useDeck reports the state the built-in controls show', () => {
  test.each([
    [
      'at the start',
      { defaultIndex: 0 },
      { index: 0, count: 5, loop: false, canPrev: false, canNext: true }
    ],
    [
      'in the middle',
      { defaultIndex: 2 },
      { index: 2, count: 5, loop: false, canPrev: true, canNext: true }
    ],
    [
      'at the end',
      { defaultIndex: 4 },
      { index: 4, count: 5, loop: false, canPrev: true, canNext: false }
    ],
    [
      'at the start of a loop',
      { defaultIndex: 0, loop: true },
      { index: 0, count: 5, loop: true, canPrev: true, canNext: true }
    ],
    [
      'at the end of a loop',
      { defaultIndex: 4, loop: true },
      { index: 4, count: 5, loop: true, canPrev: true, canNext: true }
    ]
  ] as const)('%s', (_, props, expected) => {
    renderDeck(props);

    expect(probed()).toEqual({ ...expected, fits: false });
    const shown = builtIns();
    expect(shown).toEqual({
      fits: false,
      canPrev: expected.canPrev,
      canNext: expected.canNext,
      index: expected.index,
      count: expected.count
    });
  });

  test('with pages, it counts pages, as Dots and Counter do', async () => {
    addStyle(pagesOf(3));
    renderDeck({ slides: 10, viewportClassName: 'pages' });
    expect(probed()).toEqual({
      index: 0,
      count: 4,
      loop: false,
      fits: false,
      canPrev: false,
      canNext: true
    });

    for (let page = 1; page < 4; page++) {
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      await expect.poll(() => probed().index).toBe(page);
      const { index, count, canPrev, canNext } = probed();
      expect({ index, count, canPrev, canNext }).toEqual({
        index: builtIns().index,
        count: builtIns().count,
        canPrev: builtIns().canPrev,
        canNext: builtIns().canNext
      });
    }
    expect(probed().canNext).toBe(false);
  });

  test('when every slide fits, there is nowhere to go', () => {
    addStyle(`.fits > * { width: 25%; }`);
    renderDeck({ slides: 4, viewportClassName: 'fits' });

    expect(probed()).toEqual({
      index: 0,
      count: 1,
      loop: false,
      fits: true,
      canPrev: false,
      canNext: false
    });
    expect(builtIns().fits).toBe(true);
  });

  test('a looping deck whose slides all fit does not loop on', () => {
    addStyle(`.fits > * { width: 25%; }`);
    renderDeck({ slides: 4, viewportClassName: 'fits', loop: true });

    expect(probed()).toMatchObject({
      fits: true,
      canPrev: false,
      canNext: false
    });
    expect(builtIns().fits).toBe(true);
  });

  test('follows the deck as it settles somewhere new', async () => {
    renderDeck({ slides: 3 });

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await expect.poll(() => probed().index).toBe(1);
    expect(probed()).toMatchObject({ canPrev: true, canNext: true });

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await expect.poll(() => probed().index).toBe(2);
    expect(probed()).toMatchObject({ canPrev: true, canNext: false });
    expect(builtIns()).toMatchObject({ canPrev: true, canNext: false });
  });
});

/** A design system's button: its own props, not a `<button>`'s. */
function FancyButton({
  isDisabled,
  onPress,
  children
}: {
  isDisabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="fancy"
      aria-disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) onPress();
      }}
    >
      {children}
    </button>
  );
}

function CustomControls() {
  const { index, count, canPrev, canNext, prev, next, scrollTo } =
    Deck.useDeck();
  return (
    <>
      <FancyButton isDisabled={!canPrev} onPress={prev}>
        Back
      </FancyButton>
      <FancyButton isDisabled={!canNext} onPress={next}>
        Forward
      </FancyButton>
      <FancyButton isDisabled={false} onPress={() => scrollTo(0)}>
        First
      </FancyButton>
      <output>{count === null ? '' : `Photo ${index + 1} of ${count}`}</output>
    </>
  );
}

describe('a custom control built on useDeck', () => {
  test('moves the deck, and disables at the ends as Deck.Next does', async () => {
    render(<TestDeck slides={3} controls={<CustomControls />} />);
    const viewport = viewportOf(
      screen.getByRole('region', { name: 'Test deck' })
    );
    const forward = screen.getByRole('button', { name: 'Forward' });
    const back = screen.getByRole('button', { name: 'Back' });
    const builtInNext = screen.getByRole('button', { name: 'Next' });
    const status = screen.getByRole('status');
    expect(back.getAttribute('aria-disabled')).toBe('true');
    expect(status.textContent).toBe('Photo 1 of 3');

    await userEvent.click(forward);
    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
    expect(status.textContent).toBe('Photo 2 of 3');
    expect(back.getAttribute('aria-disabled')).toBe('false');

    await userEvent.click(forward);
    await expectSettledTo(() => viewport.scrollLeft, 2 * WIDTH);
    expect(forward.getAttribute('aria-disabled')).toBe('true');
    expect(builtInNext.hasAttribute('disabled')).toBe(true);

    await userEvent.click(back);
    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
    expect(forward.getAttribute('aria-disabled')).toBe('false');
    expect(builtInNext.hasAttribute('disabled')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'First' }));
    await expectSettledTo(() => viewport.scrollLeft, 0);
    expect(status.textContent).toBe('Photo 1 of 3');
  });

  test('stops autoplay, as a built-in control does', async () => {
    await parkMouse();
    render(
      <TestDeck
        autoplay={300}
        controls={
          <>
            <Deck.AutoplayToggle />
            <CustomControls />
          </>
        }
      />
    );
    const root = screen.getByRole('region', { name: 'Test deck' });
    await expect.poll(() => root.dataset.index, { timeout: 2000 }).toBe('1');

    // Activated without focus, as Safari clicks a button.
    const forward = screen.getByRole('button', { name: 'Forward' });
    forward.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    forward.click();

    expect(document.activeElement).not.toBe(forward);
    await expect.poll(() => root.dataset.index, { timeout: 2000 }).toBe('2');
    expect(
      screen.getByRole('button', { name: 'Start slide rotation' })
    ).toBeTruthy();
    await sleep(900);
    expect(root.dataset.index).toBe('2');
  });
});

test("useDeck's consumer re-renders when the deck settles, never while it scrolls", async () => {
  let renders = 0;
  render(
    <TestDeck
      controls={
        <Profiler id="probe" onRender={() => renders++}>
          <Probe />
        </Profiler>
      }
    />
  );
  const viewport = viewportOf(
    screen.getByRole('region', { name: 'Test deck' })
  );
  await sleep(100);
  let scrolls = 0;
  viewport.addEventListener('scroll', () => scrolls++);
  renders = 0;

  // A scroll that comes back to where it started: nothing to report.
  await userEvent.wheel(viewport, { delta: { x: 20 } });
  await expectSettledTo(() => viewport.scrollLeft, 0);
  expect(scrolls).toBeGreaterThan(1);
  expect(renders).toBe(0);

  // A smooth scroll to the next snap point: one settle.
  scrolls = 0;
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await expectSettledTo(() => viewport.scrollLeft, WIDTH);
  expect(scrolls).toBeGreaterThan(5);
  expect(renders).toBe(1);
  expect(probed().index).toBe(1);
});

test('useDeck outside a deck names the missing primitive', () => {
  // React logs the error it rethrows; keep the run's output readable.
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(() => render(<Probe />)).toThrow(
      'Deck.useDeck must be inside Deck.Root'
    );
  } finally {
    spy.mockRestore();
  }
});
