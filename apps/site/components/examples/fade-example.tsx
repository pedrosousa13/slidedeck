'use client';

import * as Deck from '@slidedeck/react';
import { fade } from '@slidedeck/react/fade';

export default function Fade() {
  return (
    <Deck.Root aria-label="Crossfade">
      <Deck.Viewport effect={fade}>
        <Deck.Slide>One</Deck.Slide>
        <Deck.Slide>Two</Deck.Slide>
        <Deck.Slide>Three</Deck.Slide>
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
    </Deck.Root>
  );
}
