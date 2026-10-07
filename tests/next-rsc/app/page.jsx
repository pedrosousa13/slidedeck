// A server component: no 'use client' here. It renders decks as the package
// README documents them, with each effect and the theme.
import * as Deck from '@slidedeck/react';
import { curve } from '@slidedeck/react/curve';
import { fade } from '@slidedeck/react/fade';
import '@slidedeck/react/theme.css';

export default function Page() {
  return (
    <main>
      <Deck.Root aria-label="Featured" loop>
        <Deck.Viewport effect={fade}>
          <Deck.Slide>Slide one</Deck.Slide>
          <Deck.Slide>Slide two</Deck.Slide>
          <Deck.Slide>Slide three</Deck.Slide>
        </Deck.Viewport>
        <Deck.Prev />
        <Deck.Next />
        <Deck.Dots />
        <Deck.Counter />
      </Deck.Root>
      <Deck.Root aria-label="Curved">
        <Deck.Viewport effect={curve}>
          <Deck.Slide>Curved one</Deck.Slide>
          <Deck.Slide>Curved two</Deck.Slide>
        </Deck.Viewport>
      </Deck.Root>
    </main>
  );
}
