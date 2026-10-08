---
components: [example-middle-centred, example-middle-by-progress]
---

# Highlight the middle slide in view

The focal slide is the slide at the snap alignment point (see
[Focal slide](/docs/guides/focal-slide/)), not the middle of the slides in view. With the
default `scroll-snap-align: start`, it is the first slide in view. There are
two ways to highlight the middle one, here of three in view. Both outline it
rather than dim the others, which would lower their text's contrast.

## Centre the slides

**Centre the slides.** The alignment point is then the centre, so the focal
slide is the middle one: style `[data-focal]`. `onFocalChange` and
`clickToFocus` then follow the middle slide too.

<!-- example: apps/storybook/stories/recipes/middle-centred.css -->

```css
/* Three slides in view, centred: the focal slide is the middle one. */
.products [data-slidedeck-viewport] {
  gap: 16px;
}
.products [data-slidedeck-slide] {
  width: calc((100% - 2 * 16px) / 3);
  scroll-snap-align: center;
}
.products [data-slidedeck-slide][data-focal] {
  outline: 3px solid #335;
  outline-offset: -3px;
}
```

At the ends, the middle slide is the second and the second to last; add the
padding of [centre the first and last slide](/docs/recipes/centred-ends/)
to let the first and last slides reach the middle.

## Style by progress

**Keep the slides at the start and style by progress.** The focal slide stays
the first in view, at progress 0, so the middle of three is at progress 1, and
of `n` in view at `(n - 1) / 2`. Progress changes every frame, so the
highlight moves with the scroll, where `[data-focal]` changes when the deck
settles.

<!-- example: apps/storybook/stories/recipes/middle-by-progress.css -->

```css
/* Three slides in view, at the start: the focal slide is the first in view,
   at progress 0, and the middle one is at progress 1. */
.products [data-slidedeck-viewport] {
  gap: 16px;
}
.products [data-slidedeck-slide] {
  width: calc((100% - 2 * 16px) / 3);
  /* Slides from the middle, at most 1. abs() spelled with max() for older
     browsers. */
  --from-middle: min(
    max(var(--deck-slide-progress, 0) - 1, 1 - var(--deck-slide-progress, 0)),
    1
  );
  outline: 3px solid rgb(51 51 85 / calc(1 - var(--from-middle)));
  outline-offset: -3px;
}
```

The stories are `Recipes / Middle Centred` and `Recipes / Middle By Progress`.
End-to-end tests check that the slide nearest the viewport's centre is the one
highlighted, at rest and after Next.
