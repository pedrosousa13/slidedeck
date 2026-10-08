'use client';

import * as Deck from '@slidedeck/react';

// A vertical deck; styles/docs.css gives its viewport a height.
export default function Vertical() {
  return (
    <Deck.Root
      aria-label="Vertical slides"
      className="example-vertical"
      orientation="vertical"
    >
      <Deck.Viewport>
        <Deck.Slide>One</Deck.Slide>
        <Deck.Slide>Two</Deck.Slide>
        <Deck.Slide>Three</Deck.Slide>
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
    </Deck.Root>
  );
}
