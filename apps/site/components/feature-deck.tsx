'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as Deck from '@slidedeck/react';
// The landing page's styles, all of them: a server component's CSS import
// reaches no page, so the page's first island carries it.
import '../styles/landing.css';

interface Feature {
  name: string;
  title: string;
  body: string;
  /** A drawing of the feature, decoration only. */
  drawing: ReactNode;
}

const card = (className = '') => (
  <span className={`feature-card ${className}`.trim()} />
);

// Every claim is one the package README makes.
const FEATURES: Feature[] = [
  {
    name: 'Native scroll snap',
    title: 'The browser scrolls. slidedeck keeps count.',
    body: 'Momentum, snapping and focus scrolling are the browser’s own. slidedeck tracks where the deck rests and asks the browser to move.',
    drawing: (
      <>
        {card()}
        {card('feature-card-accent feature-card-large')}
        {card()}
      </>
    )
  },
  {
    name: 'Loop',
    title: 'Past the last slide, back to the first.',
    body: 'No visible jump. A drag, a flick or a wheel crosses the seam, and the copies stay inert.',
    drawing: (
      <>
        {card('feature-card-copy')}
        {card()}
        {card('feature-card-accent')}
        {card()}
        {card('feature-card-copy')}
      </>
    )
  },
  {
    name: 'Fade',
    title: 'A crossfade that still scrolls.',
    body: 'Import it from its own entry point. A deck that imports no effect ships none of its code.',
    drawing: (
      <span className="feature-fade">
        {card()}
        {card('feature-card-accent')}
      </span>
    )
  },
  {
    name: 'Curve',
    title: 'Slides on an arc.',
    body: 'The viewport keeps scrolling, snapping and dragging natively under the effect.',
    drawing: (
      <span className="feature-arc">
        {card()}
        {card()}
        {card('feature-card-accent feature-card-large')}
        {card()}
        {card()}
      </span>
    )
  },
  {
    name: 'Autoplay',
    title: 'Moves on its own. Stops when asked.',
    body: 'A pointer over the deck pauses it. A preference for reduced motion stops it from the start.',
    drawing: (
      <span className="feature-pill">
        <span className="feature-dot" />
        <span className="feature-dot feature-dot-current" />
        <span className="feature-dot" />
        <span className="feature-dot" />
        <span className="feature-pause" />
      </span>
    )
  },
  {
    name: 'Accessibility',
    title: 'Accessible from the first render.',
    body: 'A labelled region, slides labelled “n of m”, real buttons and a polite live region.',
    drawing: (
      <span className="feature-tree">
        <span>region · "Featured products"</span>
        <span>
          group · <span className="feature-accent">"2 of 6"</span>
        </span>
        <span>button · "Next"</span>
      </span>
    )
  }
];

/**
 * The feature gallery. Autoplay is off until the viewer starts it: slidedeck
 * starts a deck's `autoplay` on mount, so the deck has none, and so no
 * `Deck.AutoplayToggle`, until this start button sets it. From then on the
 * toggle stops and starts it.
 */
export default function FeatureDeck() {
  const [autoplay, setAutoplay] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  // The start button is gone: focus goes to the toggle that replaced it.
  useEffect(() => {
    if (autoplay) toggle.current?.focus();
  }, [autoplay]);

  return (
    <Deck.Root
      aria-label="Features"
      className="feature-deck"
      autoplay={autoplay ? 5000 : undefined}
    >
      <Deck.Viewport>
        {FEATURES.map((feature) => (
          <Deck.Slide key={feature.name}>
            <div className="feature-tile" data-feature={feature.name}>
              <p className="feature-name">{feature.name}</p>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
              <div className="feature-drawing" aria-hidden="true">
                {feature.drawing}
              </div>
            </div>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
      {/* First among the controls, after the slides, as the README asks. */}
      {autoplay ? (
        <Deck.AutoplayToggle ref={toggle} />
      ) : (
        <button
          type="button"
          className="feature-autoplay-start"
          onClick={() => setAutoplay(true)}
        >
          Start slide rotation
        </button>
      )}
      <Deck.Dots />
    </Deck.Root>
  );
}
