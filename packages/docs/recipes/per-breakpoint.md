---
title: Change effect, loop or autoplay per breakpoint
label: Per breakpoint
description: "Switch a slidedeck deck's effect, loop or autoplay at a breakpoint: read the media query in your component and pass the props it picks, with CSS in step."
---

A prop cannot read a media query, so read it in your component and pass the
props it picks. A deck takes a new `effect`, `loop` or `autoplay` after it
mounts: it stays at its current index, at rest on its snap point, and
announces nothing. A move in flight still ends where it was going. Where the
new layout has fewer snap points than the index needs, the deck rests on the
last one and reports it, through `onIndexChange` and the live region. Here a
narrow screen crossfades one slide at a time, and from 768px the deck shows
three slides and loops:

<!-- demo:example-per-breakpoint -->

[example: responsive-deck.tsx]: https://github.com/pedrosousa13/slidedeck/blob/main/apps/storybook/stories/recipes/responsive-deck.tsx

```tsx
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
```

Slides per view stays in CSS, at the same breakpoint:

[example: responsive-deck.css]: https://github.com/pedrosousa13/slidedeck/blob/main/apps/storybook/stories/recipes/responsive-deck.css

```css
/* From 768px, the breakpoint the hook reads, three slides in view, 16px
   apart. Below it, fade shows one slide at a time and ignores slide width. */
@media (min-width: 768px) {
  .products [data-slidedeck-viewport] {
    gap: 16px;
  }
  .products [data-slidedeck-slide] {
    width: calc((100% - 2 * 16px) / 3);
  }
}
```

Notes:

- Keep the breakpoint in the hook and in CSS the same, so the CSS applies
  only where the deck does not fade: fade lays out the slides itself.
- Server HTML, and hydrating it, use the hook's `initial`, `false` here: the
  narrow layout. On a wide screen the deck then switches to the loop once it
  mounts, on the same slide. Pass the `initial` most of your visitors see.
- Autoplay works the same way: `autoplay={wide ? 5000 : undefined}` rotates
  the deck on wide screens only. Keep `Deck.AutoplayToggle` in the deck; it is
  absent while `autoplay` is unset.
- The deck keeps its index, not its slide. With [pages](../guides/pages.md), an index is
  a page, so on the side of the breakpoint that pages, the same index shows
  other slides than on the side that fades.

The story is `Recipes / Per Breakpoint`. An end-to-end test resizes the window
across 768px both ways and checks that the deck stays on its slide, with no
index reported and nothing announced.
