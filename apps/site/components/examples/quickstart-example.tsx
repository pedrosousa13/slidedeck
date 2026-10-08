'use client';

import * as Deck from '@slidedeck/react';

// The Quickstart's deck, as its code block has it.
export default function Quickstart() {
  return (
    <Deck.Root aria-label="Featured products">
      <Deck.Viewport>
        <Deck.Slide>Slide one</Deck.Slide>
        <Deck.Slide>Slide two</Deck.Slide>
        <Deck.Slide>Slide three</Deck.Slide>
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
      <Deck.Dots />
      <Deck.Counter />
    </Deck.Root>
  );
}
