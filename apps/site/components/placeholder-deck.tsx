'use client';

import * as Deck from '@slidedeck/react';

export default function PlaceholderDeck() {
  return (
    <Deck.Root aria-label="Placeholder slides">
      <Deck.Viewport>
        <Deck.Slide>Slide 1</Deck.Slide>
        <Deck.Slide>Slide 2</Deck.Slide>
        <Deck.Slide>Slide 3</Deck.Slide>
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
      <Deck.Dots />
    </Deck.Root>
  );
}
