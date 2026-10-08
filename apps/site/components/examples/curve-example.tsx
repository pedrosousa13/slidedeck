'use client';

import * as Deck from '@slidedeck/react';
import { curve } from '@slidedeck/react/curve';

// Each slide holds one card that fills it: curve draws on a slide's content.
export default function Curve() {
  return (
    <Deck.Root aria-label="Showcase" className="example-curve">
      <Deck.Viewport effect={curve}>
        {['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'].map((name) => (
          <Deck.Slide key={name}>
            <div className="card">{name}</div>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
    </Deck.Root>
  );
}
