import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import * as Deck from '@slidedeck/react';
import { fade } from '@slidedeck/react/fade';

/** Whether `query` matches. Server HTML, and hydrating it, use `initial`;
 * the browser's answer follows once mounted, and every change after. */
export function useMediaQuery(query: string, initial = false) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => initial
  );
}

/** A crossfade, one slide at a time, on a narrow screen; from 768px, a deck
 * that loops. Slides per view stays in CSS, at the same breakpoint. */
export function ResponsiveDeck({ children }: { children: ReactNode }) {
  const wide = useMediaQuery('(min-width: 768px)');
  return (
    <Deck.Root aria-label="Featured slides" className="products" loop={wide}>
      <Deck.Viewport effect={wide ? undefined : fade}>{children}</Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
    </Deck.Root>
  );
}
