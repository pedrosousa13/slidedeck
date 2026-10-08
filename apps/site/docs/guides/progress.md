---
components: [example-progress]
---

# Progress and data attributes

Slidedeck writes continuous state to the DOM, not to React state, so CSS can
read it while the deck scrolls:

| Where                 | Attribute or property        | Meaning                                                                                                                      |
| --------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Each slide            | `--deck-slide-progress`      | Signed distance from the focal position, in slides: 0 there, -1 one slide before, 2.25 two and a quarter after. Every frame. |
| Each slide            | `--deck-slide-index`         | The slide's index. Static, so server HTML has it.                                                                            |
| Each slide            | `data-in-view`               | Any part of the slide is in the viewport. Hides nothing.                                                                     |
| Each slide            | `data-focal`                 | The focal slide.                                                                                                             |
| Each slide            | `data-current`               | The current slide.                                                                                                           |
| `Deck.Root`           | `data-index`                 | The current index, as of the last settle; before the first measurement, the `defaultIndex` (or `index`) as given.            |
| `Deck.Viewport`       | `data-orientation`           | `horizontal` or `vertical`.                                                                                                  |
| `Deck.Prev`/`Next`    | `data-disabled`              | Disabled, at an end or by your `disabled` prop.                                                                              |
| `Deck.Dots`           | `data-index`, `data-count`   | The current page and the page count; each dot has `data-index`.                                                              |
| `Deck.Counter`        | `data-index`, `data-count`   | The same.                                                                                                                    |
| `Deck.AutoplayToggle` | `data-playing`               | Autoplay is on.                                                                                                              |
| `Deck.Viewport`       | `data-slidedeck-effect`      | The effect's name, `fade` or `curve`, when it has one.                                                                       |
| Loop copies           | `data-slidedeck-copy`        | `before` or `after` the slides. Copies are `inert` and `aria-hidden`.                                                        |
| Snap targets          | `data-slidedeck-snap-target` | The empty elements fade lays out to snap to. Not slides.                                                                     |

Every primitive also carries a marker attribute to select it by, whatever
your class names: `data-slidedeck-viewport`, `data-slidedeck-slide` (copies
included), `data-slidedeck-prev`, `data-slidedeck-next`,
`data-slidedeck-dots`, `data-slidedeck-counter` and
`data-slidedeck-autoplay-toggle`. The live region is `data-slidedeck-live`.

Each slide's `--deck-slide-progress` is in the server HTML too, counted from
the slide the deck starts at, so CSS on it paints before any script runs (see
[server rendering](/docs/guides/server-rendering/)).

Progress is a whole number for every slide when one sits exactly at the focal
position. An effect that moves a slide should scale about its snap alignment
point (`transform-origin`), not away from it, or it moves the point progress
is measured from:

```css
.products [data-slidedeck-slide] {
  /* abs() spelled with max() for older browsers. */
  scale: calc(
    1 -
      min(
        max(var(--deck-slide-progress, 0), -1 * var(--deck-slide-progress, 0)),
        1
      ) *
      0.2
  );
  transform-origin: center;
}
```
