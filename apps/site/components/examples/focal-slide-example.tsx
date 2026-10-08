'use client';

import * as Deck from '@slidedeck/react';

// Three slides in view, centred, so the focal slide is the middle one; a
// click brings a slide there. styles/docs.css outlines `[data-focal]`.
export default function FocalSlide() {
  return (
    <Deck.Root aria-label="Focal slide" className="example-focal" clickToFocus>
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
    </Deck.Root>
  );
}
