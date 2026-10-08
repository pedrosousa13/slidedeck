'use client';

import * as Deck from '@slidedeck/react';
import { curve } from '@slidedeck/react/curve';

const SLIDES = Array.from({ length: 9 }, (_, i) => i + 1);

const colour = (n: number) =>
  n === 5 ? 'curve-card-accent' : n % 2 === 0 ? 'curve-card-even' : '';

/** The curve gallery: `effect={curve}` on a deck that loops, starting on its
 * middle, accent card. */
export default function CurveDeck() {
  return (
    <Deck.Root
      aria-label="Curve effect"
      className="curve-deck"
      defaultIndex={4}
      loop
    >
      <Deck.Viewport effect={curve}>
        {SLIDES.map((n) => (
          <Deck.Slide key={n}>
            {/* The curve draws on the slide's one child. Its colour is by
                its number, not its position: a loop's copies are slides
                too. */}
            <div className={`curve-card ${colour(n)}`}>{n}</div>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
      <Deck.Dots />
    </Deck.Root>
  );
}
