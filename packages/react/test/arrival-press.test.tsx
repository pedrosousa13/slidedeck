import { beforeEach, describe, expect, test } from 'vitest';
import { addStyle, pagesOf, parkMouse, withoutScrollEnd } from './fixtures';
import {
  SWEEP_MS,
  Uncontrolled,
  pressTwiceAtEveryDelay
} from './arrival-helpers';

// Moves as the deck arrives, before its scroll ends (#41): see
// arrival-helpers.tsx for the sweep of delays these tests share.

beforeEach(parkMouse);

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
