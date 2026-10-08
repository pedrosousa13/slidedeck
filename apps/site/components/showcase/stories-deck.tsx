'use client';

import * as Deck from '@slidedeck/react';
import { STORIES, type Photo } from './photos.ts';
import '../../styles/examples.css';

interface Story {
  place: string;
  caption: string;
  photo: Photo;
}

const ITEMS: Story[] = [
  {
    place: 'SoHo, New York',
    caption: 'Cobbles before the shops open.',
    photo: STORIES.street
  },
  {
    place: 'Douro Valley',
    caption: 'Harvest starts on Monday.',
    photo: STORIES.grapes
  },
  {
    place: 'Cordillera Blanca',
    caption: 'Four hours up. Worth it.',
    photo: STORIES.trail
  },
  {
    place: 'Studio kitchen',
    caption: 'Tonight’s table, set early.',
    photo: STORIES.forks
  }
];

/** Stories: `orientation="vertical"` in a phone-shaped frame, full height. */
export default function StoriesDeck() {
  return (
    <Deck.Root
      aria-label="Travel stories"
      className="stories-deck"
      orientation="vertical"
    >
      <Deck.Viewport>
        {ITEMS.map((story) => (
          <Deck.Slide key={story.place}>
            <figure className="story">
              <img
                src={story.photo.src}
                width={story.photo.width}
                height={story.photo.height}
                alt={story.photo.alt}
                loading="lazy"
              />
              <figcaption>
                <h3>{story.place}</h3>
                <p>{story.caption}</p>
              </figcaption>
            </figure>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Counter />
      <Deck.Next />
    </Deck.Root>
  );
}
