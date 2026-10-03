import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import { expectSettledTo, TestDeck, viewportOf, WIDTH } from './fixtures';

const renderDeck = (props: { defaultIndex?: number } = {}) => {
  render(<TestDeck controls={<Deck.Counter />} {...props} />);
  const root = screen.getByRole('region', { name: 'Test deck' });
  return {
    viewport: viewportOf(root),
    counter: root.querySelector<HTMLElement>('[data-slidedeck-counter]')!
  };
};

test('the counter shows the current snap point and the total', async () => {
  const { viewport, counter } = renderDeck();
  expect(counter.textContent).toBe('1 / 5');

  await userEvent.click(screen.getByRole('button', { name: 'Next' }));

  await expectSettledTo(() => viewport.scrollLeft, WIDTH);
  expect(counter.textContent).toBe('2 / 5');
});

test('the counter starts at defaultIndex', () => {
  const { counter } = renderDeck({ defaultIndex: 3 });

  expect(counter.textContent).toBe('4 / 5');
});

test('the counter carries data-index and data-count', async () => {
  const { viewport, counter } = renderDeck();

  await userEvent.click(screen.getByRole('button', { name: 'Next' }));

  await expectSettledTo(() => viewport.scrollLeft, WIDTH);
  expect(counter.getAttribute('data-index')).toBe('1');
  expect(counter.getAttribute('data-count')).toBe('5');
});
