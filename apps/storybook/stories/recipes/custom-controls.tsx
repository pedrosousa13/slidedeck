import * as Deck from '@slidedeck/react';
// Your design system's button.
import { Button } from './design-system';

/** Previous, Next, a button per page and a counter, from your own button. */
function Controls() {
  const { index, count, fits, canPrev, canNext, prev, next, scrollTo } =
    Deck.useDeck();
  // Every slide fits: there is nowhere to go.
  if (fits) return null;
  return (
    <div className="controls">
      <Button isDisabled={!canPrev} onPress={prev}>
        Previous
      </Button>
      {/* Pages, as Deck.Dots: none until the deck is measured. */}
      <div role="group" aria-label="Choose page">
        {Array.from({ length: count ?? 0 }, (_, page) => (
          <Button
            key={page}
            aria-label={`Go to page ${page + 1}`}
            aria-current={page === index ? 'true' : undefined}
            onPress={() => scrollTo(page)}
          >
            {page + 1}
          </Button>
        ))}
      </div>
      <span>{count !== null && `${index + 1} / ${count}`}</span>
      <Button isDisabled={!canNext} onPress={next}>
        Next
      </Button>
    </div>
  );
}

export function Products() {
  return (
    <Deck.Root aria-label="Featured slides">
      <Deck.Viewport>
        <Deck.Slide>One</Deck.Slide>
        <Deck.Slide>Two</Deck.Slide>
        <Deck.Slide>Three</Deck.Slide>
        <Deck.Slide>Four</Deck.Slide>
      </Deck.Viewport>
      <Controls />
    </Deck.Root>
  );
}
