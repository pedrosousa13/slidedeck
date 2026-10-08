'use client';

import * as Deck from '@slidedeck/react';

// Two and a half slides in view, a 16px gap, centred: styles/docs.css.
export default function Layout() {
  return (
    <Deck.Root aria-label="Products" className="example-layout">
      <Deck.Viewport>
        <Deck.Slide>One</Deck.Slide>
        <Deck.Slide>Two</Deck.Slide>
        <Deck.Slide>Three</Deck.Slide>
        <Deck.Slide>Four</Deck.Slide>
        <Deck.Slide>Five</Deck.Slide>
        <Deck.Slide>Six</Deck.Slide>
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
      <Deck.Dots />
    </Deck.Root>
  );
}
