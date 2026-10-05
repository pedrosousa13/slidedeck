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

describe('autoplay', () => {
  test('advances one snap point each interval', async () => {
    const { root } = renderDeck();

    await sleep(INTERVAL / 2);
    expect(root.dataset.index).toBe('0');
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('2');
  });

  test('counts the interval from where the deck comes to rest', async () => {
    const handle = createRef<Deck.RootHandle>();
    const { root } = renderDeck({ autoplay: 800, handleRef: handle });

    await sleep(400);
    handle.current!.next();
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
    // The tick due 800ms after mount waits for 800ms of rest.
    await sleep(500);
    expect(root.dataset.index).toBe('1');
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('2');
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

    await pressToggle();
    expect(toggleOf().textContent).toBe('Stop slide rotation');
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('0');
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
  });

  test('with loop, goes on from the last snap point to the first, quietly', async () => {
    const { root } = renderDeck({ slides: 3, defaultIndex: 1, loop: true });

    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('2');
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('0');
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
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

    await expect.poll(indexOf(root), { timeout: 3000 }).toBe('2');
    expect(viewportOf(root).scrollLeft).toBe(2 * WIDTH);
  });
});

describe('pausing', () => {
  test('a pointer over the deck pauses it, and leaving resumes it', async () => {
    const { root, viewport } = renderDeck();

    await userEvent.hover(viewport);
    await expectStill(root, '0');
    expect(toggleOf().textContent).toBe('Stop slide rotation');

    await userEvent.unhover(viewport);
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
  });

  test('focus within the deck stops it until the toggle starts it', async () => {
    const { root } = renderDeck();

    screen.getByRole('button', { name: 'Button 1' }).focus();
    await expectStill(root, '0');
    expect(toggleOf().textContent).toBe('Start slide rotation');

    // Focus leaving does not resume it.
    (document.activeElement as HTMLElement).blur();
    await expectStill(root, '0');

    await pressToggle();
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
  });

  test('focus on the toggle itself does not stop it', async () => {
    const { root } = renderDeck();

    toggleOf().focus();

    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
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

    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
  });

  test('reduced motion starts it stopped, and the toggle still starts it', async () => {
    await setReducedMotion(true);
    onTestFinished(() => setReducedMotion(false));
    const { root } = renderDeck();

    expect(toggleOf().textContent).toBe('Start slide rotation');
    await expectStill(root, '0');

    await pressToggle();
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
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
    await expect.poll(indexOf(root), { timeout: 3000 }).toBe('2');

    handle.current!.scrollTo(1);

    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('2');
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
    await expect.poll(indexOf(root), { timeout: 3000 }).toBe('2');

    screen.getByRole('button', { name: 'Back to 2' }).click();

    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('2');
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
    const { root, viewport } = renderDeck({
      controls: (
        <>
          <Deck.AutoplayToggle />
          <Deck.Dots />
        </>
      )
    });
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
    await userEvent.hover(viewport);
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

    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
    expect(live.getAttribute('aria-live')).toBe('off');

    await pressToggle();
    expect(live.getAttribute('aria-live')).toBe('polite');
  });

  test('does not announce a step autoplay started, though stopped mid-step', async () => {
    const { root, viewport } = renderDeck();
    const live = liveRegionOf(root);
    toggleOf().focus();
    await new Promise((resolve) =>
      viewport.addEventListener('scroll', resolve, { once: true })
    );

    await userEvent.keyboard('{Enter}');

    expect(live.getAttribute('aria-live')).toBe('polite');
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('1');
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
    await pressToggle();
    await expect.poll(indexOf(root), { timeout: 2000 }).toBe('2');
    await press('Previous');

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
