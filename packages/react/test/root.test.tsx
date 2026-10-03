import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import * as Deck from '@slidedeck/react';

// A placeholder that proves the browser-mode pipe. The tracer-bullet issue
// (#6) replaces Deck.Root with the real primitive.
test('Deck.Root renders its children in a real browser', () => {
  render(<Deck.Root>First slide</Deck.Root>);

  const root = screen.getByText('First slide');
  expect(root.hasAttribute('data-slidedeck-root')).toBe(true);
  // Only a real layout engine gives an element a size; a DOM emulation
  // reports zero for every box.
  expect(root.getBoundingClientRect().height).toBeGreaterThan(0);
});
