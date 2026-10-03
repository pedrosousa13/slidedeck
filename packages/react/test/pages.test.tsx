import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import { expectSettledTo, TestDeck, viewportOf, WIDTH } from './fixtures';

// A page is a group of slides that snap together (CONTEXT.md). Geometry is
// consumer CSS (ADR-0003), so grouping is too: only the first slide of each
// group is a snap target. Both rules have the same specificity, so a later
// group size, as in a media query, overrides every slide's alignment.
const groupsOf = (size: number, selector = '.groups') => `
  ${selector} > [data-slidedeck-slide]:nth-child(${size}n + 1) {
    scroll-snap-align: start;
  }
  ${selector} > [data-slidedeck-slide]:not(:nth-child(${size}n + 1)) {
    scroll-snap-align: none;
  }
`;

let removeStyle = () => {};
afterEach(() => removeStyle());

function addStyle(css: string) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  removeStyle = () => style.remove();
}

const renderGroupedDeck = () => {
  render(
    <TestDeck
      slides={10}
      viewportClassName="groups"
      controls={
        <>
          <Deck.Dots />
          <Deck.Counter />
        </>
      }
    />
  );
  const root = screen.getByRole('region', { name: 'Test deck' });
  return {
    root,
    viewport: viewportOf(root),
    next: screen.getByRole('button', { name: 'Next' }),
    dots: () =>
      within(root)
        .getByRole('group', { name: 'Choose page' })
        .querySelectorAll('button'),
    counter: () => root.querySelector('[data-slidedeck-counter]')?.textContent
  };
};

describe('groups of 3 over 10 slides', () => {
  test('Next moves three slides, and the last page is reachable', async () => {
    addStyle(groupsOf(3));
    const { viewport, next } = renderGroupedDeck();

    await userEvent.click(next);
    await expectSettledTo(() => viewport.scrollLeft, 3 * WIDTH);
    await userEvent.click(next);
    await expectSettledTo(() => viewport.scrollLeft, 6 * WIDTH);
    // The last page holds one slide, the tenth.
    await userEvent.click(next);
    await expectSettledTo(() => viewport.scrollLeft, 9 * WIDTH);
    expect((next as HTMLButtonElement).disabled).toBe(true);
  });

  test('with three slides in view, the partial last page rests at the end', async () => {
    addStyle(`${groupsOf(3)} .groups > * { width: calc(100% / 3); }`);
    const { viewport, next, dots } = renderGroupedDeck();
    const end = viewport.scrollWidth - viewport.clientWidth;

    await userEvent.click(next);
    await expectSettledTo(() => viewport.scrollLeft, WIDTH);
    await userEvent.click(next);
    await expectSettledTo(() => viewport.scrollLeft, 2 * WIDTH);
    // Slide 10 starts past the end of the scroll range, so its page rests
    // at the end: a page of its own, with a dot of its own.
    await userEvent.click(next);
    await expectSettledTo(() => viewport.scrollLeft, end);
    expect(dots()).toHaveLength(4);
    expect(dots()[3].getAttribute('aria-current')).toBe('true');
    expect((next as HTMLButtonElement).disabled).toBe(true);
  });

  test('dots render one per page and the counter counts pages', async () => {
    addStyle(groupsOf(3));
    const { viewport, next, dots, counter } = renderGroupedDeck();

    expect(dots()).toHaveLength(4);
    expect(counter()).toBe('1 / 4');

    await userEvent.click(next);
    await expectSettledTo(() => viewport.scrollLeft, 3 * WIDTH);
    expect(counter()).toBe('2 / 4');
    expect(dots()[1].getAttribute('aria-current')).toBe('true');
  });

  test('a dot moves to its page', async () => {
    addStyle(groupsOf(3));
    const { viewport, dots, counter } = renderGroupedDeck();

    await userEvent.click(dots()[3]);

    await expectSettledTo(() => viewport.scrollLeft, 9 * WIDTH);
    expect(counter()).toBe('4 / 4');
  });

  test('slide labels still count slides, not pages', () => {
    addStyle(groupsOf(3));
    renderGroupedDeck();

    expect(screen.getByRole('group', { name: '10 of 10' })).toBeTruthy();
  });
});

describe('group size per breakpoint', () => {
  afterEach(() => page.viewport(414, 896));

  test('a media query that changes the group size updates dots and counter', async () => {
    // Groups of 2 on narrow screens, 5 on wide ones. The deck's viewport has
    // a fixed width, so only the window resizes.
    addStyle(`
      ${groupsOf(2)}
      @media (min-width: 600px) { ${groupsOf(5)} }
    `);
    await page.viewport(400, 600);
    const { dots, counter } = renderGroupedDeck();
    expect(dots()).toHaveLength(5);
    expect(counter()).toBe('1 / 5');

    await page.viewport(800, 600);

    await expect.poll(() => dots().length).toBe(2);
    expect(counter()).toBe('1 / 2');

    await page.viewport(400, 600);

    await expect.poll(() => dots().length).toBe(5);
    expect(counter()).toBe('1 / 5');
  });
});
