---
components: [example-curve-size]
---

# Size a curve

`--deck-curve-radius` is in slides, not pixels, where a slide is the step from
one slide to the next: its width plus the gap. To turn a radius in pixels into
slides, divide it by that step: 528px under slides 160px wide and 16px apart
is `528 / (160 + 16)`, 3 slides. CSS cannot divide one length by another in
every browser, so write the number. The arc is a true circle of that radius
only along the axis, where each slide turns as it would on one. Across the
axis, its sag scales by the content's width, not the step, so with a gap the
arc sags less than the circle, by `width / (width + gap)`: here `160 / 176`.

The arc extends past the slides, and the viewport clips it across the axis, so
leave it room inside the viewport, as padding. With a radius of `r` slides,
the content of a slide `k` slides from the focal one, `w` wide and `h` tall,
drops `w × (r − √(r² − k²))` and, turned by `asin(k / r)`, reaches
`(w × k / r + h × √(r² − k²) / r − h) / 2` further. Both grow with `k` until
the slide fades out, `r` slides away, so the room at the block end is what a
slide about to fade out needs while the deck moves: `r × w + (w − h) / 2`,
460px in the CSS below. Near the focal slide, moving content also lifts above
its place, by at most about `w / (8 × r)`: 7px at the block start. A vertical
deck's arc bends toward the inline end: leave the room there, with `w` and `h`
swapped.

That room is large. At rest, the slides not faded out are those fewer than `r`
slides away, so if the faint ends of the arc may clip while the deck moves,
the room for the furthest of them is enough: for `k = 2` here, 122px of drop
and 28px of turn, 150px.

<!-- example: apps/storybook/stories/recipes/curve-size.css -->

```css
/* An arc of radius 528px under slides 160px wide and 16px apart:
   528 / (160 + 16) = 3 slides. */
.showcase [data-slidedeck-viewport] {
  --deck-curve-radius: 3;
  gap: 16px;
  /* The first and last slides centred too. */
  padding-inline: calc(50% - 80px);
  /* Room for the arc while the deck moves. Above, the lift: at most
     160 / (8 × 3), so 7px. Below, a slide about to fade out:
     3 × 160 + (160 − 200) / 2 = 460px. */
  padding-block: 7px 460px;
}
.showcase [data-slidedeck-slide] {
  width: 160px;
  scroll-snap-align: center;
}
.showcase .card {
  height: 200px;
}
```

Each slide holds one `.card` that fills it, as the curve draws on a slide's
content. The story is `Recipes / Curve Size`. An end-to-end test checks that
no slide that is not faded out reaches past the viewport, at rest and in every
frame of a move.
