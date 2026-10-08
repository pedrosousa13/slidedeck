'use client';

import * as Deck from '@slidedeck/react';

// The controls in theme.css's plain look, with a few of its --deck-* tokens
// set on `.example-theme`. styles/docs.css imports the theme, in a layer,
// and applies it to this example alone.
export default function Theme() {
  return (
    <Deck.Root
      aria-label="Themed slides"
      className="example-theme"
      autoplay={5000}
    >
      <Deck.Viewport>
        <Deck.Slide>One</Deck.Slide>
        <Deck.Slide>Two</Deck.Slide>
        <Deck.Slide>Three</Deck.Slide>
      </Deck.Viewport>
      <Deck.AutoplayToggle />
      <Deck.Prev />
      <Deck.Next />
      <Deck.Dots />
      <Deck.Counter />
    </Deck.Root>
  );
}
