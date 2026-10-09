---
title: Layout is CSS
description: 'Slides per view, gap, alignment and breakpoints are plain CSS in slidedeck, not props. The zero-specificity defaults, and how to bring the scrollbar back.'
---

Slides per view, gap, alignment and their breakpoints are plain CSS, never
props. By default each slide is as wide as the viewport and snaps at its
start. These defaults have zero specificity, so any rule of yours wins:

<!-- demo:example-layout -->

```css
/* Two and a half slides in view, a 16px gap, centred. */
.products [data-slidedeck-viewport] {
  gap: 16px;
}
.products [data-slidedeck-slide] {
  width: calc((100% - 2 * 16px) / 2.5);
  scroll-snap-align: center;
}
```

The viewport shows no scrollbar by default. It still scrolls by touch,
trackpad, mouse wheel, drag, keyboard and the controls. To bring the scrollbar
back, one rule:

```css
[data-slidedeck-viewport] {
  scrollbar-width: auto;
}
```

Safari before 18.2 does not support `scrollbar-width`, and its native
scrollbar cannot come back there: any `::-webkit-scrollbar` rule replaces it
with one drawn from your CSS. To show a styled one there instead, only where
`scrollbar-width` is not supported, so other browsers keep theirs (untested in
Safari before 18.2):

```css
@supports not (scrollbar-width: auto) {
  [data-slidedeck-viewport]::-webkit-scrollbar {
    display: block;
    width: 8px;
    height: 8px;
  }
  [data-slidedeck-viewport]::-webkit-scrollbar-thumb {
    background: rgb(0 0 0 / 0.4);
    border-radius: 4px;
  }
}
```

Media queries and container queries work as they do for anything else, and
the deck re-reads its snap points when the viewport resizes. The structural
styles a deck needs, such as the scroll container and its snap type, are set
inline on the primitives; your `style` prop is spread after them.

Centred slides rest with the first slide at the start edge, as the viewport
cannot scroll before it. To centre the first and last slides too, see
[centre the first and last slide](../recipes/centred-ends.md).
