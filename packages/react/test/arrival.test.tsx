import { createContext, createRef, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import {
  addStyle,
  expectRestOnASlide,
  mouseDrag,
  nextFrame,
  pagesOf,
  parkMouse,
  sleep,
  TestDeck,
  trackMotion,
  viewportOf,
  WIDTH
} from './fixtures';

// A scroll's `scrollend` comes a few milliseconds after the viewport arrives
// where the scroll was going (#41). Whatever the deck is asked to do in that
// moment, a press, a new controlled index or the user's own scroll, it must
// still come to rest on a slide, report the slide it shows, and have
// snapping on. The moment is a few milliseconds wide, so each test does its
// second move at each of these delays after the first, across the time a
// step takes, and checks some came after the viewport arrived. None listens
// for a scroll event or reads layout before the second move: in Chromium
// either changes which scrolls the browser ends, and hides the race.
const DELAYS = Array.from({ length: 21 }, (_, i) => 260 + i * 4);
const SWEEP_MS = 120_000;

beforeEach(parkMouse);

/** Where the slide labelled `label` rests, as a scroll position along the
 * deck, worked out from where it is now. */
function restOf(viewport: HTMLElement, label: string) {
  const slide = screen.getByRole('group', { name: label });
  const box = slide.getBoundingClientRect();
  const view = viewport.getBoundingClientRect();
  const rtl = getComputedStyle(viewport).direction === 'rtl';
  return (
    viewport.scrollLeft + (rtl ? box.right - view.right : box.left - view.left)
  );
}

const OnIndexChange = createContext<(index: number) => void>(() => {});

/** A test deck, inside a `dir` wrapper, reporting to `OnIndexChange`. */
function Uncontrolled({
  rtl = false,
  ...props
}: Parameters<typeof TestDeck>[0] & { rtl?: boolean }) {
  const onIndexChange = useContext(OnIndexChange);
  return (
    <div dir={rtl ? 'rtl' : 'ltr'}>
      <TestDeck onIndexChange={onIndexChange} {...props} />
    </div>
  );
}

/**
 * Renders `deck`, starting on the slide labelled `start`, and at every delay
 * presses `button` twice that far apart, one deck each: the deck must rest on
 * the page `expected`, of `pageSize` slides, every time.
 */
async function pressTwiceAtEveryDelay(
  deck: () => ReactNode,
  start: string,
  button: 'Next' | 'Previous',
  expected: string,
  pageSize = 1
) {
  let arrived = 0;
  for (const delay of DELAYS) {
    const onIndexChange = vi.fn();
    const { unmount } = render(
      <OnIndexChange.Provider value={onIndexChange}>
        {deck()}
      </OnIndexChange.Provider>
    );
    const root = screen.getByRole('region', { name: 'Test deck' });
    const viewport = viewportOf(root);
    const press = screen.getByRole('button', { name: button });

    press.click();
    await sleep(delay);
    press.click();
    // Read after the press: the new scroll has yet to move.
    const pressedAt = viewport.scrollLeft;

    await expectRestOnASlide(viewport, root, onIndexChange, pageSize);
    expect({ delay, index: root.dataset.index }).toEqual({
      delay,
      index: expected
    });
    if (Math.abs(pressedAt - restOf(viewport, start)) >= WIDTH - 0.5) {
      arrived++;
    }
    unmount();
  }
  expect(arrived).toBeGreaterThan(0);
}

describe('a press as the deck arrives, before its scroll ends', () => {
  test(
    'Next twice from the first slide rests on the third',
    async () => {
      await pressTwiceAtEveryDelay(
        () => <Uncontrolled />,
        '1 of 5',
        'Next',
        '2'
      );
    },
    SWEEP_MS
  );

  test(
    'right-to-left, Prev twice from the third slide rests on the first',
    async () => {
      await pressTwiceAtEveryDelay(
        () => <Uncontrolled rtl defaultIndex={2} />,
        '3 of 5',
        'Previous',
        '0'
      );
    },
    SWEEP_MS
  );

  test(
    'looping, Next twice from the last slide rests on the second',
    async () => {
      await pressTwiceAtEveryDelay(
        () => <Uncontrolled loop defaultIndex={4} />,
        '5 of 5',
        'Next',
        '1'
      );
    },
    SWEEP_MS
  );

  test(
    'looping, Prev twice from the first slide rests on the fourth',
    async () => {
      await pressTwiceAtEveryDelay(
        () => <Uncontrolled loop />,
        '1 of 5',
        'Previous',
        '3'
      );
    },
    SWEEP_MS
  );

  test(
    'right-to-left, looping, Prev twice from the second slide rests on the last',
    async () => {
      await pressTwiceAtEveryDelay(
        () => <Uncontrolled rtl loop defaultIndex={1} />,
        '2 of 5',
        'Previous',
        '4'
      );
    },
    SWEEP_MS
  );

  test(
    'pages of 3 over 10, looping, Prev twice from the second page rests on the last',
    async () => {
      addStyle(`${pagesOf(3)} .pages > * { width: calc(100% / 3); }`);
      await pressTwiceAtEveryDelay(
        () => (
          <Uncontrolled
            loop
            slides={10}
            viewportClassName="pages"
            defaultIndex={1}
          />
        ),
        '4 of 10',
        'Previous',
        '3',
        3
      );
    },
    SWEEP_MS
  );
});

describe('a press as the deck arrives, in an engine without scrollend', () => {
  const block = (event: Event) => event.stopImmediatePropagation();
  let restore = () => {};
  beforeEach(() => {
    const hosts = [window, Document.prototype, HTMLElement.prototype].filter(
      (host) => Object.hasOwn(host, 'onscrollend')
    );
    const saved = hosts.map((host) =>
      Object.getOwnPropertyDescriptor(host, 'onscrollend')!
    );
    hosts.forEach((host) => delete (host as Partial<Window>).onscrollend);
    window.addEventListener('scrollend', block, true);
    window.addEventListener('scrollsnapchange', block, true);
    restore = () => {
      hosts.forEach((host, i) =>
        Object.defineProperty(host, 'onscrollend', saved[i])
      );
      window.removeEventListener('scrollend', block, true);
      window.removeEventListener('scrollsnapchange', block, true);
    };
  });
  afterEach(() => restore());

  test(
    'looping, Next twice from the last slide rests on the second',
    async () => {
      expect('onscrollend' in window).toBe(false);
      await pressTwiceAtEveryDelay(
        () => <Uncontrolled loop defaultIndex={4} />,
        '5 of 5',
        'Next',
        '1'
      );
    },
    SWEEP_MS
  );
});

describe('a new index as the deck arrives', () => {
  // A deck synced with thumbnails, as in the Thumbnails story: both share
  // the parent's index.
  function Synced() {
    const [index, setIndex] = useState(1);
    return (
      <>
        <TestDeck index={index} onIndexChange={setIndex} />
        <Deck.Root aria-label="Thumbnails">
          <Deck.Viewport style={{ width: WIDTH }}>
            {Array.from({ length: 5 }, (_, i) => (
              <Deck.Slide key={i} style={{ width: '20%' }}>
                <button
                  type="button"
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => setIndex(i)}
                >
                  Thumb {i + 1}
                </button>
              </Deck.Slide>
            ))}
          </Deck.Viewport>
        </Deck.Root>
      </>
    );
  }

  test(
    'a thumbnail clicked as Next arrives moves the deck to its slide',
    async () => {
      let arrived = 0;
      for (const delay of DELAYS) {
        const { unmount } = render(<Synced />);
        const root = screen.getByRole('region', { name: 'Test deck' });
        const viewport = viewportOf(root);

        screen.getByRole('button', { name: 'Next' }).click();
        await sleep(delay);
        screen.getByRole('button', { name: 'Thumb 5' }).click();
        const clickedAt = viewport.scrollLeft;

        // What the parent was last told may be the slide Next went to, if it
        // settled before the click: the thumbnails show what the parent has.
        await expectRestOnASlide(viewport, root, vi.fn());
        expect({ delay, index: root.dataset.index }).toEqual({
          delay,
          index: '4'
        });
        expect(
          screen
            .getByRole('region', { name: 'Thumbnails' })
            .querySelector('[aria-current]')?.textContent
        ).toBe('Thumb 5');
        if (Math.abs(clickedAt - 2 * WIDTH) < 1) arrived++;
        unmount();
      }
      expect(arrived).toBeGreaterThan(0);
    },
    SWEEP_MS
  );
});

describe('the handle as the deck arrives', () => {
  test(
    'scrollTo then next goes on from the scrollTo',
    async () => {
      let arrived = 0;
      for (const delay of DELAYS) {
        const ref = createRef<Deck.RootHandle>();
        const onIndexChange = vi.fn();
        const { unmount } = render(
          <TestDeck handleRef={ref} onIndexChange={onIndexChange} />
        );
        const root = screen.getByRole('region', { name: 'Test deck' });
        const viewport = viewportOf(root);

        ref.current!.next();
        await sleep(delay);
        ref.current!.scrollTo(3);
        ref.current!.next();
        const calledAt = viewport.scrollLeft;

        await expectRestOnASlide(viewport, root, onIndexChange);
        expect({ delay, index: root.dataset.index }).toEqual({
          delay,
          index: '4'
        });
        if (Math.abs(calledAt - WIDTH) < 1) arrived++;
        unmount();
      }
      expect(arrived).toBeGreaterThan(0);
    },
    SWEEP_MS
  );
});

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
