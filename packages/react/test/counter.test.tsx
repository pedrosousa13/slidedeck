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

test("a consumer's data attributes cannot overwrite the counter's state", () => {
  render(
    <TestDeck
      controls={
        <Deck.Counter
          {...{
            'data-index': 'x',
            'data-count': 'y',
            'data-slidedeck-counter': 'z'
          }}
        />
      }
    />
  );
  const counter = screen.getByText('1 / 5');

  expect(counter.getAttribute('data-index')).toBe('0');
  expect(counter.getAttribute('data-count')).toBe('5');
  expect(counter.getAttribute('data-slidedeck-counter')).toBe('');
});

// As Prev, Next and Dots are: "1 / 1" and "1 / 0" say nothing.
test.each([1, 0])(
  'the counter is absent when every slide fits, as with %i slide(s)',
  (slides) => {
    render(<TestDeck slides={slides} controls={<Deck.Counter />} />);

    expect(document.querySelector('[data-slidedeck-counter]')).toBeNull();
  }
);
