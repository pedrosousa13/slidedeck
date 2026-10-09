---
title: Pages
description: 'Snap a slidedeck deck a page at a time: make the first slide of each group a snap point, and Next moves a page while Dots and Counter count pages.'
---

To snap in groups, make only the first slide of each group a snap point. Next
then moves a page, and Dots and Counter count pages:

<!-- demo:example-pages -->

```css
/* Three slides in view, three to a page, from 640px. */
@media (min-width: 640px) {
  .products [data-slidedeck-slide] {
    width: calc(100% / 3);
  }
  .products [data-slidedeck-slide]:nth-child(3n + 1) {
    scroll-snap-align: start;
  }
  .products [data-slidedeck-slide]:not(:nth-child(3n + 1)) {
    scroll-snap-align: none;
  }
}
```

Each slide is still labelled "n of m" by slide. The index, `scrollTo` and a
controlled `index` count pages, so when a breakpoint changes the page size,
the same index points at different slides.
