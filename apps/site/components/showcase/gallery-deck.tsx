'use client';

import * as Deck from '@slidedeck/react';
import { PRODUCTS, THUMBS, type Photo } from './photos.ts';
// The examples' styles: a server component's CSS import reaches no page, so
// each example's island carries them.
import '../../styles/examples.css';

interface Product {
  name: string;
  price: string;
  photo: Photo;
  thumb: Photo;
}

const ITEMS: Product[] = [
  {
    name: 'Ivory heels',
    price: '$189',
    photo: PRODUCTS.heels,
    thumb: THUMBS.heels
  },
  {
    name: 'Everyday carry kit',
    price: '$240',
    photo: PRODUCTS.carry,
    thumb: THUMBS.carry
  },
  { name: 'Stamp mug', price: '$24', photo: PRODUCTS.mug, thumb: THUMBS.mug },
  {
    name: 'House blend',
    price: '$16',
    photo: PRODUCTS.coffee,
    thumb: THUMBS.coffee
  }
];

/** A thumbnail per photo in place of dots: the custom controls recipe, with
 * an image in each page button. It reads the deck only when it settles. */
function Thumbnails() {
  const { index, fits, scrollTo } = Deck.useDeck();
  if (fits) return null;
  return (
    <div role="group" aria-label="Choose page" className="gallery-thumbs">
      {ITEMS.map((item, page) => (
        <button
          key={item.name}
          type="button"
          aria-label={`Go to page ${String(page + 1)}`}
          aria-current={page === index ? 'true' : undefined}
          onClick={() => scrollTo(page)}
        >
          <img
            src={item.thumb.src}
            width={item.thumb.width}
            height={item.thumb.height}
            alt=""
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}

/** Large product photos with thumbnails as the dots. `eager` loads the first
 * photo at once, for a page where the gallery is above the fold. */
export default function GalleryDeck({ eager = false }: { eager?: boolean }) {
  return (
    <Deck.Root aria-label="Product photos" className="gallery-deck">
      <Deck.Viewport>
        {ITEMS.map((item, i) => (
          <Deck.Slide key={item.name}>
            <figure className="gallery-slide">
              <img
                src={item.photo.src}
                width={item.photo.width}
                height={item.photo.height}
                alt={item.photo.alt}
                loading={eager && i === 0 ? 'eager' : 'lazy'}
              />
              <figcaption>
                <h3>{item.name}</h3>
                <p>{item.price}</p>
              </figcaption>
            </figure>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
      <Thumbnails />
    </Deck.Root>
  );
}
