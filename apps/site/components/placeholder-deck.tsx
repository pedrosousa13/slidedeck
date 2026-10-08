'use client';

import * as Deck from '@slidedeck/react';

export default function PlaceholderDeck() {
  return (
    <Deck.Root aria-label="Placeholder slides" autoplay={5000}>
      <Deck.Viewport>
        <Deck.Slide>Slide 1</Deck.Slide>
        <Deck.Slide>Slide 2</Deck.Slide>
        <Deck.Slide>Slide 3</Deck.Slide>
      </Deck.Viewport>
      {/* First among the controls, as the README asks, and after the slides
          so the DOM, focus and visual orders agree. Focus entering the
          viewport stops autoplay, so the slides need not come after it. */}
      <Deck.AutoplayToggle />
      <Deck.Prev />
      <Deck.Next />
      <Deck.Dots />
    </Deck.Root>
  );
}
