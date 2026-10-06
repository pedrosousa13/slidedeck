import { createContext, createRef, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import {
  addStyle,
  expectRestOnASlide,
  mouseAt,
  mouseDrag,
  nextFrame,
  pagesOf,
  parkMouse,
  sleep,
  TestDeck,
  touchSwipe,
  trackMotion,
  viewportOf,
  wheelOver,
  WIDTH,
  withoutScrollEnd
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

/** Holds the main thread for `ms`, as a long task on the page does. */
function busy(ms: number) {
  const until = performance.now() + ms;
  while (performance.now() < until);
}

/**
 * Renders `deck`, starting on the slide labelled `start`, and at every delay
 * presses `button` twice that far apart, one deck each: the deck must rest on
 * the page `expected`, of `pageSize` slides, every time. With `busyMs`, a
 * long task holds the main thread that long right after the second press.
 */
async function pressTwiceAtEveryDelay(
  deck: () => ReactNode,
  start: string,
  button: 'Next' | 'Previous',
  expected: string,
  { pageSize = 1, delays = DELAYS, busyMs = 0 } = {}
) {
  let arrived = 0;
  for (const delay of delays) {
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
    busy(busyMs);

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
        { pageSize: 3 }
      );
    },
    SWEEP_MS
  );
});

describe('a press as the deck arrives, in an engine without scrollend', () => {
  withoutScrollEnd();

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

describe('a long task as the deck arrives', () => {
  // The browser goes on scrolling while the page's script holds the main
  // thread, and sends no scroll event until it lets go.
  const delays = Array.from({ length: 11 }, (_, i) => 260 + i * 8);

  test(
    'Next twice from the first slide rests on the third',
    async () => {
      await pressTwiceAtEveryDelay(
        () => <Uncontrolled />,
        '1 of 5',
        'Next',
        '2',
        { delays, busyMs: 150 }
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
        '1',
        { delays, busyMs: 150 }
      );
    },
    SWEEP_MS
  );
});

describe("a long task just after the user's wheel, as a looping Next arrives", () => {
  // The user's wheel ends the deck's move (ADR-0006). Measured in Chromium:
  // when a long task holds the main thread just after the wheel, the
  // browser can carry the move's smooth scroll on afterwards. It either runs
  // on to the move's target, against the wheel, or stops part way, off any
  // snap point, and never snaps the deck back. The first is the browser's,
  // and slidedeck cannot undo it. From the second, the deck re-snaps to the
  // nearest snap point the way the wheel went. Either way it comes to rest
  // exactly on a snap point.
  test(
    'a wheel back rests exactly on a snap point, the way the wheel went unless the browser ran on',
    async () => {
      const failures: unknown[] = [];
      // Where the scroll is when the wheel turns, and when the long task
      // starts after it, in ms. 3000 is the copy of the first slide: the
      // wheel turns as the deck arrives there and jumps off it.
      for (const at of [2963, 2990, 3000]) {
        for (const after of [40, 60, 80]) {
          const onIndexChange = vi.fn();
          const { unmount } = render(
            <TestDeck loop defaultIndex={4} onIndexChange={onIndexChange} />
          );
          const root = screen.getByRole('region', { name: 'Test deck' });
          const viewport = viewportOf(root);
          // Every smooth scroll the deck asks for once the wheel has
          // turned, from where to where: a re-snap. The jump off a copy is
          // instant.
          let turned = false;
          const resnaps: { from: number; to: number }[] = [];
          const scrollTo = viewport.scrollTo.bind(viewport);
          viewport.scrollTo = ((options: ScrollToOptions) => {
            if (turned && options.behavior === 'smooth') {
              resnaps.push({ from: viewport.scrollLeft, to: options.left! });
            }
            scrollTo(options);
          }) as typeof viewport.scrollTo;
          const turn = () => {
            if (viewport.scrollLeft < at) return;
            viewport.removeEventListener('scroll', turn);
            turned = true;
            void wheelOver(viewport, -200);
            setTimeout(() => busy(200), after);
          };
          viewport.addEventListener('scroll', turn);

          screen.getByRole('button', { name: 'Next' }).click();

          await expectRestOnASlide(viewport, root, onIndexChange).catch(
            (error: Error) => failures.push({ at, after, error: error.message })
          );
          const index = root.dataset.index;
          // A re-snap goes back, the wheel's way, and rests on the last
          // slide. With none, the browser rested the deck itself: where the
          // wheel left it, the last slide, or the move's target, the first.
          const expected =
            resnaps.length > 0
              ? resnaps.every(({ from, to }) => to < from) && index === '4'
              : index === '4' || index === '0';
          if (!expected) failures.push({ at, after, index, resnaps });
          unmount();
        }
      }
      expect(failures).toEqual([]);
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

describe('input that does not scroll, during a move', () => {
  // Only the user's scroll ends a move: a click, typing or Tab out of a
  // slide leaves it going, so a second press still steps on from where it
  // heads. Focus entering a slide is the user's scroll (#43): see below.
  function WithInput() {
    return (
      <Deck.Root aria-label="Test deck" defaultIndex={1}>
        <Deck.Prev />
        <Deck.Viewport style={{ width: WIDTH }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Deck.Slide key={i}>
              {/* Clear of the slide's start edge, so it stays in view as the
                  deck moves on and typing scrolls nothing. */}
              {i === 1 ? (
                <input
                  aria-label="Note"
                  style={{ marginInlineStart: 180, width: 80 }}
                />
              ) : (
                `Slide ${i + 1}`
              )}
            </Deck.Slide>
          ))}
        </Deck.Viewport>
        <Deck.Next />
      </Deck.Root>
    );
  }

  /** From the second slide, Next, then `input` 60ms on, then Next: where
   * the deck rests, and the snap point nearest the viewport as Next is
   * pressed the second time. */
  async function nextInputNext(input: (viewport: HTMLElement) => unknown) {
    render(<WithInput />);
    const root = screen.getByRole('region', { name: 'Test deck' });
    const viewport = viewportOf(root);
    const next = screen.getByRole('button', { name: 'Next' });
    screen.getByRole('textbox', { name: 'Note' }).focus();

    next.click();
    await sleep(60);
    await input(viewport);
    const from = String(Math.round(viewport.scrollLeft / WIDTH));
    next.click();

    await expectRestOnASlide(viewport, root, vi.fn());
    return { index: root.dataset.index, from };
  }

  test('a click in a slide', async () => {
    const { index } = await nextInputNext(async (viewport) => {
      const box = viewport.getBoundingClientRect();
      const y = (box.top + box.bottom) / 2;
      await mouseAt('mousePressed', box.left + 60, y, 1);
      await mouseAt('mouseReleased', box.left + 60, y, 0);
    });
    expect(index).toBe('3');
  });

  test('typing in a text box in a slide', async () => {
    const { index } = await nextInputNext(() => userEvent.keyboard('a'));
    expect(index).toBe('3');
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveProperty(
      'value',
      'a'
    );
  });

  test('Shift+Tab out of a slide', async () => {
    const { index } = await nextInputNext(() =>
      userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    );
    expect(index).toBe('3');
    // Focus goes back to the viewport, outside every slide.
    expect(document.activeElement).toHaveProperty(
      'dataset.slidedeckViewport',
      ''
    );
  });

  // The user's scroll, by contrast, ends the move: the second press steps
  // on from the snap point nearest where the user has taken the deck, not
  // from where the move was heading.
  test('an arrow key back on the viewport', async () => {
    const { index, from } = await nextInputNext((viewport) => {
      viewport.focus();
      return userEvent.keyboard('{ArrowLeft}');
    });
    expect(index).toBe(String(Number(from) + 1));
  });

  test('a wheel back', async () => {
    const { index, from } = await nextInputNext((viewport) =>
      userEvent.wheel(viewport, { delta: { x: -100 } })
    );
    expect(index).toBe(String(Number(from) + 1));
  });
});

describe('focus entering a slide during a move', () => {
  // Focus wins (#43): the browser scrolls a slide focus enters into view,
  // which is the user's scroll, so it ends the move. The deck then rests on
  // the snap point of the focused slide's page, with the focused element in
  // view, and reports and announces that page.
  //
  // Focus can enter at any time during a move, not only as it arrives, so
  // each test moves focus at each of these delays after the press, from
  // just after the scroll starts to about when it arrives.
  const FOCUS_DELAYS = [20, 60, 120, 200, 260];

  /** At every delay into a press of Next, moves focus with `focus`: the deck
   * must rest on the page `expected`, of `pageSize` slides, with the element
   * labelled `focused` in view and focused. */
  async function focusAtEveryDelay(
    props: Parameters<typeof TestDeck>[0],
    focus: () => unknown,
    focused: string,
    expected: number,
    { pageSize = 1, delays = FOCUS_DELAYS } = {}
  ) {
    for (const delay of delays) {
      const onIndexChange = vi.fn();
      const { unmount } = render(
        <TestDeck
          onIndexChange={onIndexChange}
          controls={
            <>
              <Deck.Dots />
              <Deck.Counter />
            </>
          }
          {...props}
        />
      );
      const root = screen.getByRole('region', { name: 'Test deck' });
      const viewport = viewportOf(root);

      // Focused, as Next is once the user presses it.
      const next = screen.getByRole('button', { name: 'Next' });
      next.focus();
      next.click();
      await sleep(delay);
      await focus();

      await expectRestOnASlide(viewport, root, onIndexChange, pageSize);
      const element = screen.getByRole('button', { name: focused });
      const box = element.getBoundingClientRect();
      const view = viewport.getBoundingClientRect();
      const counter = root.querySelector('[data-slidedeck-counter]')!;
      const count = counter.getAttribute('data-count');
      expect({
        delay,
        index: root.dataset.index,
        focused: document.activeElement === element,
        inView: box.left >= view.left - 0.5 && box.right <= view.right + 0.5,
        dot: root
          .querySelector('[data-slidedeck-dots] [aria-current]')
          ?.getAttribute('data-index'),
        counter: counter.textContent,
        announced: root.querySelector('[aria-live]')?.textContent
      }).toEqual({
        delay,
        index: String(expected),
        focused: true,
        inView: true,
        dot: String(expected),
        counter: `${expected + 1} / ${count}`,
        // A deck back where it started has not moved: nothing to announce.
        announced:
          expected === (props.defaultIndex ?? 0)
            ? ''
            : `Slide ${expected * pageSize + 1} of ${props.slides ?? 5}`
      });
      expect(
        viewport.querySelector('[data-focal]')?.getAttribute('aria-label')
      ).toBe(`${expected * pageSize + 1} of ${props.slides ?? 5}`);
      unmount();
    }
  }

  const focusOn = (name: string) => () =>
    screen.getByRole('button', { name }).focus();

  test(
    'Shift+Tab from Next into the last slide',
    async () => {
      await focusAtEveryDelay(
        {},
        () => userEvent.keyboard('{Shift>}{Tab}{/Shift}'),
        'Button 5',
        4
      );
    },
    SWEEP_MS
  );

  test(
    'focus into the slide the move heads to',
    async () => {
      await focusAtEveryDelay({}, focusOn('Button 2'), 'Button 2', 1);
    },
    SWEEP_MS
  );

  test(
    'focus into a slide past the one the move heads to',
    async () => {
      await focusAtEveryDelay({}, focusOn('Button 4'), 'Button 4', 3);
    },
    SWEEP_MS
  );

  test(
    'focus back into the slide the move left',
    async () => {
      await focusAtEveryDelay(
        { defaultIndex: 2 },
        focusOn('Button 3'),
        'Button 3',
        2
      );
    },
    SWEEP_MS
  );

  test(
    'looping, focus into the first slide as Next crosses the seam onto its copy',
    async () => {
      await focusAtEveryDelay(
        { loop: true, defaultIndex: 4 },
        focusOn('Button 1'),
        'Button 1',
        0
      );
    },
    SWEEP_MS
  );

  test(
    'looping, focus into the last slide as Next crosses the seam',
    async () => {
      await focusAtEveryDelay(
        { loop: true, defaultIndex: 4 },
        focusOn('Button 4'),
        'Button 4',
        3
      );
    },
    SWEEP_MS
  );

  test(
    "pages of 3 over 10, focus into a slide rests on its page's snap point",
    async () => {
      addStyle(`${pagesOf(3)} .pages > * { width: calc(100% / 3); }`);
      await focusAtEveryDelay(
        { slides: 10, viewportClassName: 'pages' },
        focusOn('Button 8'),
        'Button 8',
        2,
        { pageSize: 3 }
      );
    },
    SWEEP_MS
  );

  test('focus into a slide in no page rests on the snap point nearest it', async () => {
    // Only every third slide from the second snaps, to its start: the first
    // slide is in no page.
    addStyle(`
      .offset > * { width: calc(100% / 3); }
      .offset > [data-slidedeck-slide]:nth-child(3n + 2) {
        scroll-snap-align: start;
      }
      .offset > [data-slidedeck-slide]:not(:nth-child(3n + 2)) {
        scroll-snap-align: none;
      }
    `);
    const onIndexChange = vi.fn();
    render(
      <TestDeck
        slides={10}
        viewportClassName="offset"
        onIndexChange={onIndexChange}
      />
    );
    const root = screen.getByRole('region', { name: 'Test deck' });
    const viewport = viewportOf(root);

    screen.getByRole('button', { name: 'Next' }).click();
    await sleep(60);
    screen.getByRole('button', { name: 'Button 1' }).focus();

    await expectRestOnASlide(viewport, root, onIndexChange, 3);
    expect(root.dataset.index).toBe('0');
    expect(viewport.scrollLeft).toBe(WIDTH / 3);
  });

  test('a mouse press on a button in another slide is a click: the move goes on', async () => {
    const onIndexChange = vi.fn();
    render(<TestDeck defaultIndex={1} onIndexChange={onIndexChange} />);
    const root = screen.getByRole('region', { name: 'Test deck' });
    const viewport = viewportOf(root);
    const button = screen.getByRole('button', { name: 'Button 2' });

    screen.getByRole('button', { name: 'Next' }).click();
    await sleep(30);
    // On the part of the button the move has not yet taken out of view.
    const box = button.getBoundingClientRect();
    const view = viewport.getBoundingClientRect();
    const x = (Math.max(box.left, view.left) + box.right) / 2;
    const y = (box.top + box.bottom) / 2;
    await mouseAt('mousePressed', x, y, 1);
    await mouseAt('mouseReleased', x, y, 0);

    await expectRestOnASlide(viewport, root, onIndexChange);
    expect(document.activeElement).toBe(button);
    expect(root.dataset.index).toBe('2');
  });

  describe('in an engine without scrollend', () => {
    withoutScrollEnd();

    test(
      'looping, focus into the first slide as Next crosses the seam onto its copy',
      async () => {
        expect('onscrollend' in window).toBe(false);
        await focusAtEveryDelay(
          { loop: true, defaultIndex: 4 },
          focusOn('Button 1'),
          'Button 1',
          0
        );
      },
      SWEEP_MS
    );
  });
});

describe('focus within a slide or onto the viewport during a move', () => {
  // Neither is the user taking over (#51): the move goes on to its own
  // target. In Chromium the browser's focus scroll stops the move's scroll,
  // so the deck must start it again, and still report only what the move
  // does.
  //
  // Focus can move at any time during a move, not only as it arrives, so
  // each test moves focus at each of these delays after the press, from
  // just after the scroll starts to about when it arrives.
  const MID_MOVE_DELAYS = [20, 60, 120, 200, 260];

  /** Five slides of two buttons each, "A n" and "B n". */
  function TwoButtons(props: Deck.RootProps) {
    return (
      <Deck.Root aria-label="Test deck" {...props}>
        <Deck.Prev />
        <Deck.Viewport style={{ width: WIDTH }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Deck.Slide key={i}>
              <button type="button">A {i + 1}</button>
              <button type="button">B {i + 1}</button>
            </Deck.Slide>
          ))}
        </Deck.Viewport>
        <Deck.Next />
        <Deck.Dots />
        <Deck.Counter />
      </Deck.Root>
    );
  }

  /** At every delay into a press of Next, from focus on `from`, moves focus
   * with `focus`: the deck must rest on slide `expected`, the move's target,
   * and report it once. */
  async function moveGoesOnAtEveryDelay(
    props: Deck.RootProps,
    from: (viewport: HTMLElement) => void,
    focus: (viewport: HTMLElement) => unknown,
    expected: number
  ) {
    for (const delay of MID_MOVE_DELAYS) {
      const onIndexChange = vi.fn();
      const { unmount } = render(
        <TwoButtons onIndexChange={onIndexChange} {...props} />
      );
      const root = screen.getByRole('region', { name: 'Test deck' });
      const viewport = viewportOf(root);
      from(viewport);
      const focused = document.activeElement;

      screen.getByRole('button', { name: 'Next' }).click();
      await sleep(delay);
      await focus(viewport);
      expect(document.activeElement).not.toBe(focused);

      await expectRestOnASlide(viewport, root, onIndexChange);
      expect({
        delay,
        index: root.dataset.index,
        calls: onIndexChange.mock.calls,
        dot: root
          .querySelector('[data-slidedeck-dots] [aria-current]')
          ?.getAttribute('data-index'),
        counter: root.querySelector('[data-slidedeck-counter]')?.textContent,
        announced: root.querySelector('[aria-live]')?.textContent
      }).toEqual({
        delay,
        index: String(expected),
        calls: [[expected]],
        dot: String(expected),
        counter: `${expected + 1} / 5`,
        announced: `Slide ${expected + 1} of 5`
      });
      unmount();
    }
  }

  const focusButton =
    (name: string, preventScroll = false) =>
    () =>
      screen.getByRole('button', { name }).focus({ preventScroll });
  const focusViewport = (viewport: HTMLElement) => viewport.focus();
  const shiftTab = () => userEvent.keyboard('{Shift>}{Tab}{/Shift}');

  test(
    'focus within the slide the move leaves',
    async () => {
      await moveGoesOnAtEveryDelay(
        {},
        focusButton('A 1'),
        focusButton('B 1'),
        1
      );
    },
    SWEEP_MS
  );

  test(
    'focus within the slide the move heads to',
    async () => {
      // Focus starts in the next slide without scrolling it into view.
      await moveGoesOnAtEveryDelay(
        {},
        focusButton('A 2', true),
        focusButton('B 2'),
        1
      );
    },
    SWEEP_MS
  );

  test(
    'focus from Next onto the viewport',
    async () => {
      await moveGoesOnAtEveryDelay({}, focusButton('Next'), focusViewport, 1);
    },
    SWEEP_MS
  );

  test(
    'Shift+Tab out of a slide onto the viewport',
    async () => {
      await moveGoesOnAtEveryDelay({}, focusButton('A 1'), shiftTab, 1);
    },
    SWEEP_MS
  );

  test(
    'looping, focus within the last slide as Next crosses the seam',
    async () => {
      await moveGoesOnAtEveryDelay(
        { loop: true, defaultIndex: 4 },
        focusButton('A 5'),
        focusButton('B 5'),
        0
      );
    },
    SWEEP_MS
  );

  test(
    'looping, focus onto the viewport as Next crosses the seam',
    async () => {
      await moveGoesOnAtEveryDelay(
        { loop: true, defaultIndex: 4 },
        focusButton('Next'),
        focusViewport,
        0
      );
    },
    SWEEP_MS
  );

  test(
    'looping, focus within a slide as Next moves away from the seam',
    async () => {
      await moveGoesOnAtEveryDelay(
        { loop: true, defaultIndex: 1 },
        focusButton('A 2'),
        focusButton('B 2'),
        2
      );
    },
    SWEEP_MS
  );

  test('a press right after focus within a slide still steps on', async () => {
    const onIndexChange = vi.fn();
    render(<TwoButtons onIndexChange={onIndexChange} />);
    const root = screen.getByRole('region', { name: 'Test deck' });
    const viewport = viewportOf(root);
    const next = screen.getByRole('button', { name: 'Next' });
    screen.getByRole('button', { name: 'A 1' }).focus();

    next.click();
    await sleep(60);
    screen.getByRole('button', { name: 'B 1' }).focus();
    next.click();

    await expectRestOnASlide(viewport, root, onIndexChange);
    expect(root.dataset.index).toBe('2');
  });

  test("the user's scroll right after focus within a slide ends the move", async () => {
    const onIndexChange = vi.fn();
    render(<TwoButtons onIndexChange={onIndexChange} />);
    const root = screen.getByRole('region', { name: 'Test deck' });
    const viewport = viewportOf(root);
    screen.getByRole('button', { name: 'A 1' }).focus();

    screen.getByRole('button', { name: 'Next' }).click();
    await sleep(60);
    screen.getByRole('button', { name: 'B 1' }).focus();
    // A wheel back to the start, before the move's scroll starts again.
    viewport.dispatchEvent(new WheelEvent('wheel', { deltaX: -WIDTH }));
    viewport.scrollTo({ left: 0, behavior: 'instant' });

    await expectRestOnASlide(viewport, root, onIndexChange);
    expect(root.dataset.index).toBe('0');
  });

  test('focus entering another slide right after focus within a slide goes to that slide', async () => {
    const onIndexChange = vi.fn();
    render(<TwoButtons onIndexChange={onIndexChange} />);
    const root = screen.getByRole('region', { name: 'Test deck' });
    const viewport = viewportOf(root);
    screen.getByRole('button', { name: 'A 1' }).focus();

    screen.getByRole('button', { name: 'Next' }).click();
    await sleep(60);
    screen.getByRole('button', { name: 'B 1' }).focus();
    const a4 = screen.getByRole('button', { name: 'A 4' });
    a4.focus();

    await expectRestOnASlide(viewport, root, onIndexChange);
    expect(root.dataset.index).toBe('3');
    expect(document.activeElement).toBe(a4);
  });
});
describe('a pointer held on the deck', () => {
  test('as the deck arrives on a copy, it jumps off the copy only once the pointer lets go', async () => {
    const onIndexChange = vi.fn();
    render(<TestDeck loop defaultIndex={4} onIndexChange={onIndexChange} />);
    const root = screen.getByRole('region', { name: 'Test deck' });
    const viewport = viewportOf(root);
    const box = viewport.getBoundingClientRect();
    const [x, y] = [box.left + 60, (box.top + box.bottom) / 2];
    // Five copies before the slides: slide 1's copy after them is at 10.
    const copy = 10 * WIDTH;

    screen.getByRole('button', { name: 'Next' }).click();
    await sleep(100);
    await mouseAt('mousePressed', x, y, 1);
    await expect.poll(() => viewport.scrollLeft).toBe(copy);
    await sleep(300);
    expect(viewport.scrollLeft).toBe(copy);

    await mouseAt('mouseReleased', x, y, 0);
    await expectRestOnASlide(viewport, root, onIndexChange);
    expect(root.dataset.index).toBe('0');
  });
});

describe('a pointer whose release the deck does not hear', () => {
  // A pointer still down holds the settle; one whose release never reaches
  // the deck must not hold it for good.
  test('a touch whose pointerup and lostpointercapture a slide stops', async () => {
    const onIndexChange = vi.fn();
    render(<TestDeck loop defaultIndex={3} onIndexChange={onIndexChange} />);
    const root = screen.getByRole('region', { name: 'Test deck' });
    const viewport = viewportOf(root);
    const next = screen.getByRole('button', { name: 'Next' });
    const slide = screen.getByRole('group', { name: '4 of 5' });
    const stop = (event: Event) => event.stopPropagation();
    slide.addEventListener('pointerup', stop);
    slide.addEventListener('lostpointercapture', stop);

    await touchSwipe(slide, 0);
    next.click();
    await expectRestOnASlide(viewport, root, onIndexChange);
    expect(root.dataset.index).toBe('4');
    // Across the seam: it jumps off the copy.
    next.click();
    await expectRestOnASlide(viewport, root, onIndexChange);
    expect(root.dataset.index).toBe('0');
  });

  test("a click whose pointerup a slide's React handler stops, during a move", async () => {
    const onIndexChange = vi.fn();
    render(
      <Deck.Root
        aria-label="Test deck"
        loop
        defaultIndex={4}
        onIndexChange={onIndexChange}
      >
        <Deck.Prev />
        <Deck.Viewport style={{ width: WIDTH }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Deck.Slide key={i}>
              <div
                style={{ height: 100 }}
                onPointerUp={(event) => event.stopPropagation()}
              >
                Slide {i + 1}
              </div>
            </Deck.Slide>
          ))}
        </Deck.Viewport>
        <Deck.Next />
      </Deck.Root>
    );
    const root = screen.getByRole('region', { name: 'Test deck' });
    const viewport = viewportOf(root);
    const box = viewport.getBoundingClientRect();
    const y = box.top + 50;

    screen.getByRole('button', { name: 'Next' }).click();
    await sleep(100);
    await mouseAt('mousePressed', box.left + 60, y, 1);
    await mouseAt('mouseReleased', box.left + 60, y, 0);

    // The mouse does not move again: the deck must settle on its own.
    await expectRestOnASlide(viewport, root, onIndexChange);
    expect(root.dataset.index).toBe('0');
  });

  test('a mouse pressed on the deck that never lets go, then the window losing focus', async () => {
    const onIndexChange = vi.fn();
    render(
      <TestDeck
        loop
        autoplay={300}
        onIndexChange={onIndexChange}
        controls={<Deck.AutoplayToggle />}
      />
    );
    const root = screen.getByRole('region', { name: 'Test deck' });
    const viewport = viewportOf(root);
    const box = viewport.getBoundingClientRect();
    const off = [5, window.innerHeight - 5] as const;
    onTestFinished(async () => {
      await mouseAt('mouseReleased', ...off, 0);
    });

    await mouseAt('mousePressed', box.left + 60, (box.top + box.bottom) / 2, 1);
    // Off the deck with the button still down, where no pointerup comes.
    await mouseAt('mouseMoved', ...off, 1);
    // The press focused the deck, which stopped autoplay: start it again.
    (document.activeElement as HTMLElement).blur();
    document
      .querySelector<HTMLButtonElement>('[data-slidedeck-autoplay-toggle]')!
      .click();
    await sleep(1000);
    window.dispatchEvent(new FocusEvent('blur'));

    const steps = onIndexChange.mock.calls.length;
    await expect
      .poll(() => onIndexChange.mock.calls.length, { timeout: 4000 })
      .toBeGreaterThanOrEqual(steps + 3);
    expect(viewport.style.scrollSnapType).not.toBe('none');
  });
});
