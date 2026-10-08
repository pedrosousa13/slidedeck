'use client';

import { useState } from 'react';
import * as Deck from '@slidedeck/react';

// A controlled deck, and a button outside it that sets its index.
export default function Controlled() {
  const [index, setIndex] = useState(0);
  return (
    <>
      <Deck.Root aria-label="Photos" index={index} onIndexChange={setIndex}>
        <Deck.Viewport>
          <Deck.Slide>One</Deck.Slide>
          <Deck.Slide>Two</Deck.Slide>
          <Deck.Slide>Three</Deck.Slide>
        </Deck.Viewport>
        <Deck.Prev />
        <Deck.Next />
      </Deck.Root>
      <div className="docs-controls">
        <button type="button" onClick={() => setIndex(2)}>
          Last photo
        </button>
        <span>index: {index}</span>
      </div>
    </>
  );
}
