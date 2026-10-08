'use client';

import * as Deck from '@slidedeck/react';

// Three slides to a page from 640px, so Next moves a page and the dots count
// pages: styles/docs.css.
export default function Pages() {
  return (
    <Deck.Root aria-label="Pages of products" className="example-pages">
      <Deck.Viewport>
        {['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'].map(
          (name) => (
            <Deck.Slide key={name}>{name}</Deck.Slide>
          )
        )}
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
      <Deck.Dots />
      <Deck.Counter />
    </Deck.Root>
  );
}
