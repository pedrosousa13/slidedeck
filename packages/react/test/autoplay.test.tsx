import { createRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import {
  gestureScroll,
  parkMouse,
  setReducedMotion,
  sleep,
  TestDeck,
  touchSwipe,
  viewportOf,
  WIDTH
} from './fixtures';

/** The autoplay interval most tests use, in milliseconds: short enough to
 * step several times within a poll's timeout. */
const INTERVAL = 300;

beforeEach(parkMouse);

const renderDeck = (props: Parameters<typeof TestDeck>[0] = {}) => {
  render(
    <TestDeck
      autoplay={INTERVAL}
      controls={<Deck.AutoplayToggle />}
      {...props}
    />
  );
  const root = screen.getByRole('region', { name: 'Test deck' });
  return { root, viewport: viewportOf(root) };
};

const indexOf = (root: HTMLElement) => () => root.dataset.index;
const toggleOf = () =>
  document.querySelector<HTMLButtonElement>(
    '[data-slidedeck-autoplay-toggle]'
  )!;
const liveRegionOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[aria-live]')!;

/** Activates the toggle from the keyboard, so no pointer hovers the deck. */
const pressToggle = async () => {
  toggleOf().focus();
  await userEvent.keyboard('{Enter}');
};

/** Waits several intervals and checks the deck did not move. */
const expectStill = async (root: HTMLElement, index: string) => {
  await sleep(INTERVAL * 3);
  expect(root.dataset.index).toBe(index);
};

/**
 * Records each index the deck comes to rest at from now on, in order, and
 * calls `onRest` as it does. Autoplay rests at each for only an interval and
 * a step: on a busy machine a poll of the index can miss one, and a test
 * that acts after a poll can act after the next step has begun.
 */
const watchRests = (root: HTMLElement, onRest?: (index: string) => void) => {
  const rests: string[] = [];
  const observer = new MutationObserver(() => {
    rests.push(root.dataset.index!);
    onRest?.(root.dataset.index!);
  });
  observer.observe(root, { attributeFilter: ['data-index'] });
  onTestFinished(() => observer.disconnect());
  return rests;
};

/**
 * Renders the deck with the pointer over it, playing: stopped at once, so no
 * step can come before the pointer does, however long the hover takes, then
 * started from the keyboard.
 */
const renderHovered = async (props: Parameters<typeof TestDeck>[0] = {}) => {
  const deck = renderDeck(props);
  toggleOf().click();
  await userEvent.hover(deck.viewport);
  await pressToggle();
  return deck;
};

describe('autoplay', () => {
  test('advances one snap point each interval', async () => {
    const { root } = renderDeck();
    const rests = watchRests(root);

    await sleep(INTERVAL / 2);
    expect(root.dataset.index).toBe('0');
    await expect
      .poll(() => rests.slice(0, 2), { timeout: 4000 })
      .toEqual(['1', '2']);
  });

  test('counts the interval from where the deck comes to rest', async () => {
    const handle = createRef<Deck.RootHandle>();
    const { root } = renderDeck({ autoplay: 800, handleRef: handle });
    const restedAt: number[] = [];
    const rests = watchRests(root, () => restedAt.push(performance.now()));

    await sleep(400);
    handle.current!.next();
    await expect
      .poll(() => rests.slice(0, 2), { timeout: 4000 })
      .toEqual(['1', '2']);
    // The tick due 800ms after mount waits for 800ms of rest, then a step.
    expect(restedAt[1] - restedAt[0]).toBeGreaterThanOrEqual(800);
  });

  test('stops at the last snap point, and Start rewinds and resumes', async () => {
    const { root } = renderDeck({ slides: 3 });

    await expect.poll(indexOf(root), { timeout: 3000 }).toBe('2');
    await expect
      .poll(() => toggleOf().textContent)
      .toBe('Start slide rotation');
    expect(toggleOf().hasAttribute('data-playing')).toBe(false);
    expect(liveRegionOf(root).getAttribute('aria-live')).toBe('polite');
    await expectStill(root, '2');

    const rests = watchRests(root);
    await pressToggle();
    expect(toggleOf().textContent).toBe('Stop slide rotation');
    await expect
      .poll(() => rests.slice(0, 2), { timeout: 4000 })
      .toEqual(['0', '1']);
  });

  test('with loop, goes on from the last snap point to the first, quietly', async () => {
    const { root } = renderDeck({ slides: 3, defaultIndex: 1, loop: true });
    const rests = watchRests(root);

    await expect
      .poll(() => rests.slice(0, 3), { timeout: 6000 })
      .toEqual(['2', '0', '1']);
    expect(toggleOf().textContent).toBe('Stop slide rotation');
    expect(liveRegionOf(root).textContent).toBe('');
  });

  test('without autoplay, the deck stays put and there is no toggle', async () => {
    const { root } = renderDeck({ autoplay: undefined });

    expect(toggleOf()).toBeNull();
    await expectStill(root, '0');
  });

  test('a controlled parent that refuses the move keeps the deck', async () => {
    const onIndexChange = vi.fn();
    const { viewport } = renderDeck({
      autoplay: 1000,
      index: 0,
      onIndexChange
    });

    await expect
      .poll(() => onIndexChange.mock.calls[0], { timeout: 3000 })
      .toEqual([1]);
    await expect.poll(() => viewport.scrollLeft, { timeout: 2000 }).toBe(0);
  });

  test('a step a controlled parent refuses ends autoplay', async () => {
    const onIndexChange = vi.fn();
    const { root, viewport } = renderDeck({ index: 0, onIndexChange });

    await expect
      .poll(() => toggleOf().textContent, { timeout: 3000 })
      .toBe('Start slide rotation');
    expect(toggleOf().hasAttribute('data-playing')).toBe(false);
    await expectStill(root, '0');
    expect(viewport.scrollLeft).toBe(0);
    expect(onIndexChange).toHaveBeenCalledTimes(1);
  });

  test('a controlled parent that takes the move advances', async () => {
    function Controlled() {
      const [index, setIndex] = useState(0);
      return (
        <TestDeck autoplay={INTERVAL} index={index} onIndexChange={setIndex} />
      );
    }
    render(<Controlled />);
    const root = screen.getByRole('region', { name: 'Test deck' });
    const restsAt: number[] = [];
    const rests = watchRests(root, () =>
      restsAt.push(viewportOf(root).scrollLeft)
    );

    await expect
      .poll(() => rests.slice(0, 2), { timeout: 4000 })
      .toEqual(['1', '2']);
    expect(restsAt.slice(0, 2)).toEqual([WIDTH, 2 * WIDTH]);
  });
});

describe('pausing', () => {
  test('a pointer over the deck pauses it, and leaving resumes it', async () => {
    const { root, viewport } = await renderHovered();
    const rests = watchRests(root);

    await expectStill(root, '0');
    expect(toggleOf().textContent).toBe('Stop slide rotation');

    await userEvent.unhover(viewport);
    await expect.poll(() => rests[0], { timeout: 2000 }).toBe('1');
  });

  test('focus within the deck stops it until the toggle starts it', async () => {
    const { root } = renderDeck();

    screen.getByRole('button', { name: 'Button 1' }).focus();
    await expectStill(root, '0');
    expect(toggleOf().textContent).toBe('Start slide rotation');

    // Focus leaving does not resume it.
    (document.activeElement as HTMLElement).blur();
    await expectStill(root, '0');

    const rests = watchRests(root);
    await pressToggle();
    await expect.poll(() => rests[0], { timeout: 2000 }).toBe('1');
  });

  test('focus on the toggle itself does not stop it', async () => {
    const { root } = renderDeck();
    const rests = watchRests(root);

    toggleOf().focus();

    await expect.poll(() => rests[0], { timeout: 2000 }).toBe('1');
    expect(toggleOf().textContent).toBe('Stop slide rotation');
  });

  test('a hidden document pauses it, and showing it resumes it', async () => {
    let state: DocumentVisibilityState = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => state
    );
    onTestFinished(() => void vi.restoreAllMocks());
    const { root } = renderDeck();

    state = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await expectStill(root, '0');

    const rests = watchRests(root);
    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await expect.poll(() => rests[0], { timeout: 2000 }).toBe('1');
  });

  let visibility: DocumentVisibilityState = 'visible';

  // A pause comes before the render that clears the step's timer: a step
  // falling due between the two must not run. The cause comes in the task
  // that runs the step, just before it, so nothing renders in between.
  test.each([
    [
      'a pointer entering',
      (viewport: Element) =>
        viewport.dispatchEvent(
          new PointerEvent('pointerover', { bubbles: true })
        ),
      (viewport: Element) =>
        viewport.dispatchEvent(
          new PointerEvent('pointerout', { bubbles: true })
        )
    ],
    [
      'the document hiding',
      () => {
        visibility = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
      },
      () => {
        visibility = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
      }
    ]
  ])('%s as a step falls due pauses it', async (_, pause, resume) => {
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => visibility
    );
    const { setTimeout } = window;
    let armed = true;
    vi.spyOn(window, 'setTimeout').mockImplementation(((
      callback: () => void,
      ms?: number
    ) => {
      if (!armed || ms !== INTERVAL) return setTimeout(callback, ms);
      armed = false;
      return setTimeout(() => {
        pause(viewportOf(screen.getByRole('region')));
        callback();
      }, ms);
    }) as typeof window.setTimeout);
    onTestFinished(() => void vi.restoreAllMocks());
    const { root, viewport } = renderDeck();

    await expectStill(root, '0');
    expect(armed).toBe(false);

    const rests = watchRests(root);
    resume(viewport);
    await expect.poll(() => rests[0], { timeout: 2000 }).toBe('1');
  });

  test('reduced motion starts it stopped, and the toggle still starts it', async () => {
    await setReducedMotion(true);
    onTestFinished(() => setReducedMotion(false));
    const { root } = renderDeck();

    expect(toggleOf().textContent).toBe('Start slide rotation');
    await expectStill(root, '0');

    const rests = watchRests(root);
    await pressToggle();
    await expect.poll(() => rests[0], { timeout: 2000 }).toBe('1');
  });
});

describe('a move the user makes', () => {
  test('a touch swipe stops it, and its settle is announced', async () => {
    const { root, viewport } = renderDeck({ autoplay: 1500 });
    const live = liveRegionOf(root);

    await touchSwipe(viewport, 150);

    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
    await expect.poll(() => live.textContent).toBe('Slide 2 of 5');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(toggleOf().textContent).toBe('Start slide rotation');
    await expectStill(root, '1');
  });

  test('a wheel scroll stops it, and its settle is announced', async () => {
    const { root, viewport } = renderDeck({ autoplay: 1500 });
    const live = liveRegionOf(root);

    await gestureScroll(viewport, WIDTH);

    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
    await parkMouse();
    await expect.poll(() => live.textContent).toBe('Slide 2 of 5');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(toggleOf().textContent).toBe('Start slide rotation');
    await expectStill(root, '1');
  });

  test('focus entering a slide mid-step stops it, and its settle is announced', async () => {
    const { root, viewport } = renderDeck();
    const live = liveRegionOf(root);
    await new Promise((resolve) =>
      viewport.addEventListener('scroll', resolve, { once: true })
    );

    // Focus wins (#43): the deck goes to the focused slide instead.
    screen.getByRole('button', { name: 'Button 4' }).focus();

    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('3');
    await expect.poll(() => live.textContent).toBe('Slide 4 of 5');
    expect(toggleOf().textContent).toBe('Start slide rotation');
    await expectStill(root, '3');
  });

  test('focus on the viewport mid-step stops it, and the step is not announced', async () => {
    const { root, viewport } = renderDeck();
    const live = liveRegionOf(root);
    await new Promise((resolve) =>
      viewport.addEventListener('scroll', resolve, { once: true })
    );

    // Late in the step, so it ends on the next snap point. Focus outside
    // every slide is not the user's move.
    await sleep(150);
    viewport.focus();

    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
    expect(toggleOf().textContent).toBe('Start slide rotation');
    await sleep(INTERVAL);
    expect(live.textContent).toBe('');
  });
});

describe('a move autoplay did not start', () => {
  test('a handle call back to where autoplay stepped from keeps it rotating', async () => {
    const handle = createRef<Deck.RootHandle>();
    const { root } = renderDeck({ handleRef: handle });

    // Back as autoplay rests at 2, before its next step can begin.
    const rests = watchRests(root, (index) => {
      if (index === '2' && rests.length === 2) handle.current!.scrollTo(1);
    });

    await expect
      .poll(() => rests.slice(0, 4), { timeout: 6000 })
      .toEqual(['1', '2', '1', '2']);
    expect(toggleOf().textContent).toBe('Stop slide rotation');
  });

  test('a new controlled index back to where autoplay stepped from keeps it rotating', async () => {
    function Controlled() {
      const [index, setIndex] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setIndex(1)}>
            Back to 2
          </button>
          <TestDeck
            autoplay={INTERVAL}
            index={index}
            onIndexChange={setIndex}
            controls={<Deck.AutoplayToggle />}
          />
        </>
      );
    }
    render(<Controlled />);
    const root = screen.getByRole('region', { name: 'Test deck' });
    const back = screen.getByRole('button', { name: 'Back to 2' });

    // Back as autoplay rests at 2, before its next step can begin.
    const rests = watchRests(root, (index) => {
      if (index === '2' && rests.length === 2) back.click();
    });

    await expect
      .poll(() => rests.slice(0, 4), { timeout: 6000 })
      .toEqual(['1', '2', '1', '2']);
    expect(toggleOf().textContent).toBe('Stop slide rotation');
  });
});

describe('a control the user activates', () => {
  // Safari does not focus a button on click, so focus entering the deck
  // cannot be what stops it: each control is activated without focus.
  test.each([
    ['Previous', '0'],
    ['Next', '2'],
    ['Go to page 3', '2']
  ])('%s stops it, though the pointer then leaves', async (name, index) => {
    const { root } = await renderHovered({
      defaultIndex: 1,
      controls: (
        <>
          <Deck.AutoplayToggle />
          <Deck.Dots />
        </>
      )
    });
    const control = screen.getByRole('button', { name });

    control.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    control.click();

    expect(document.activeElement).not.toBe(control);
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe(index);
    await parkMouse();
    expect(toggleOf().textContent).toBe('Start slide rotation');
    await expectStill(root, index);
  });
});

describe('Deck.AutoplayToggle', () => {
  test('is a button named for the action it takes, marked while playing', async () => {
    const { root } = renderDeck();
    const toggle = screen.getByRole('button', { name: 'Stop slide rotation' });
    expect(toggle.hasAttribute('data-playing')).toBe(true);
    expect(toggle.hasAttribute('aria-pressed')).toBe(false);

    await pressToggle();

    expect(screen.getByRole('button', { name: 'Start slide rotation' })).toBe(
      toggle
    );
    expect(toggle.hasAttribute('data-playing')).toBe(false);
    await expectStill(root, '0');
  });

  test("a consumer's onClick runs first and can cancel the toggle", async () => {
    render(
      <TestDeck
        autoplay={INTERVAL}
        controls={
          <Deck.AutoplayToggle onClick={(event) => event.preventDefault()} />
        }
      />
    );

    await pressToggle();

    expect(toggleOf().textContent).toBe('Stop slide rotation');
  });
});

describe('the live region', () => {
  test('announces a change the user makes, politely', async () => {
    const { root } = renderDeck({ autoplay: undefined });
    const live = liveRegionOf(root);
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toBe('');

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await expect.poll(() => live.textContent).toBe('Slide 2 of 5');
  });

  test('is off while autoplay rotates, and polite once it stops', async () => {
    const { root } = renderDeck();
    const live = liveRegionOf(root);
    expect(live.getAttribute('aria-live')).toBe('off');
    const rests = watchRests(root);

    await expect.poll(() => rests[0], { timeout: 2000 }).toBe('1');
    expect(live.getAttribute('aria-live')).toBe('off');

    await pressToggle();
    expect(live.getAttribute('aria-live')).toBe('polite');
  });

  test('does not announce a step autoplay started, though stopped mid-step', async () => {
    const { root, viewport } = renderDeck();
    const live = liveRegionOf(root);
    const rests = watchRests(root);

    // Stopped as the step's scroll begins, however busy the machine.
    await new Promise((resolve) =>
      viewport.addEventListener('scroll', () => resolve(toggleOf().click()), {
        once: true
      })
    );

    expect(live.getAttribute('aria-live')).toBe('polite');
    await expect.poll(() => rests[0], { timeout: 2000 }).toBe('1');
    await sleep(INTERVAL);
    expect(live.textContent).toBe('');
  });

  test('announces a user move to the slide last announced, after autoplay moved on', async () => {
    const { root } = renderDeck();
    const live = liveRegionOf(root);
    const texts: string[] = [];
    const observer = new MutationObserver(() => texts.push(live.textContent!));
    observer.observe(live, {
      childList: true,
      characterData: true,
      subtree: true
    });
    onTestFinished(() => observer.disconnect());
    const press = async (name: string) => {
      screen.getByRole('button', { name }).focus();
      await userEvent.keyboard('{Enter}');
    };

    await press('Next');
    await expect.poll(() => live.textContent).toBe('Slide 2 of 5');
    // Focus stops it as it rests at 2, before its next step can begin.
    const previous = screen.getByRole('button', { name: 'Previous' });
    watchRests(root, (index) => {
      if (index === '2') previous.focus();
    });
    await pressToggle();
    await expect.poll(() => document.activeElement).toBe(previous);
    await userEvent.keyboard('{Enter}');

    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
    await expect
      .poll(() => texts.filter((t) => t === 'Slide 2 of 5').length)
      .toBe(2);
    expect(texts).not.toContain('Slide 3 of 5');
  });

  test('is polite while a pointer pauses autoplay', async () => {
    const { root, viewport } = renderDeck();

    await userEvent.hover(viewport);

    expect(liveRegionOf(root).getAttribute('aria-live')).toBe('polite');
  });
});
