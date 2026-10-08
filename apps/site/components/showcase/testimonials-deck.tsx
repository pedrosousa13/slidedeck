'use client';

import * as Deck from '@slidedeck/react';
import '../../styles/examples.css';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  /** The avatar's colour, by person rather than by position. */
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'teal';
}

// A made-up roastery's customers.
const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'The beans arrive two days after roasting, and you can taste it.',
    name: 'Maya Chen',
    role: 'Home barista',
    tone: 'blue'
  },
  {
    quote: 'We moved the whole café over in a week. Our regulars noticed.',
    name: 'Tomás Rivera',
    role: 'Café owner',
    tone: 'orange'
  },
  {
    quote: 'I skip a month when I ask. No emails, no calls, no fuss.',
    name: 'Priya Nair',
    role: 'Subscriber',
    tone: 'green'
  },
  {
    quote: 'Every bag says where it grew and how to brew it.',
    name: 'Jonas Weber',
    role: 'Coffee teacher',
    tone: 'purple'
  },
  {
    quote: 'Packaging we can compost. That settled it for the office.',
    name: 'Amara Okafor',
    role: 'Office manager',
    tone: 'teal'
  }
];

const initials = (name: string) =>
  name
    .split(' ')
    .map((word) => word[0])
    .join('');

/** Centred cards with their neighbours in view: the recipe "Centre the first
 * and last slide". */
export default function TestimonialsDeck() {
  return (
    <Deck.Root aria-label="Customer reviews" className="testimonials-deck">
      <Deck.Viewport>
        {TESTIMONIALS.map((item) => (
          <Deck.Slide key={item.name}>
            <figure className="testimonial">
              <blockquote>
                <p>“{item.quote}”</p>
              </blockquote>
              <figcaption>
                <span
                  className="testimonial-avatar"
                  data-tone={item.tone}
                  aria-hidden="true"
                >
                  {initials(item.name)}
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <span>{item.role}</span>
                </span>
              </figcaption>
            </figure>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Dots />
      <Deck.Next />
    </Deck.Root>
  );
}
