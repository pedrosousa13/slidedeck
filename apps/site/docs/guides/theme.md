# Theme

An optional stylesheet gives the controls (Prev, Next, Dots, Counter and
AutoplayToggle) a plain appearance. Slides stay your CSS, and a deck works
without it.

```ts
import '@slidedeck/react/theme.css';
```

Every rule is wrapped in `:where()`, so any selector of yours wins. Every value
is a custom property; set one on the deck or any ancestor:

| Token                              | Default                       | Styles                                                 |
| ---------------------------------- | ----------------------------- | ------------------------------------------------------ |
| `--deck-control-color`             | `#1a1a1a`                     | Text of Prev, Next, the counter and the stopped toggle |
| `--deck-control-background`        | `#ffffff`                     | Background of Prev, Next and the toggle                |
| `--deck-control-hover-background`  | `#f0f0f0`                     | Their background under a pointer                       |
| `--deck-control-border`            | `1px solid #767676`           | Their border                                           |
| `--deck-control-radius`            | `0.375rem`                    | Their corner radius                                    |
| `--deck-control-padding`           | `0.375rem 0.75rem`            | Their padding                                          |
| `--deck-control-font-size`         | `0.875rem`                    | Their font size, and the counter's                     |
| `--deck-control-disabled-opacity`  | `0.4`                         | Prev or Next while disabled                            |
| `--deck-control-active-background` | `var(--deck-accent, #0b5cd5)` | The autoplay toggle while autoplay plays               |
| `--deck-control-active-color`      | `#ffffff`                     | Its text while autoplay plays                          |
| `--deck-dot-color`                 | `#767676`                     | A dot that is not the current page                     |
| `--deck-dot-hover-color`           | `#1a1a1a`                     | Such a dot under a pointer                             |
| `--deck-dot-size`                  | `0.625rem`                    | The dot drawn                                          |
| `--deck-dot-current-width`         | `1.25rem`                     | The current dot's width, so it differs by shape        |
| `--deck-dot-radius`                | `9999px`                      | A dot's corner radius                                  |
| `--deck-dot-target-size`           | `1.5rem`                      | The square a dot answers clicks in                     |
| `--deck-dot-gap`                   | `0.25rem`                     | Space between dots                                     |
| `--deck-accent`                    | `#0b5cd5`                     | The current dot, the focus ring and the playing toggle |
| `--deck-focus-width`               | `2px`                         | Width of the keyboard focus ring                       |
| `--deck-focus-offset`              | `2px`                         | Space between a control and its focus ring             |
| `--deck-transition-duration`       | `150ms`                       | Hover and state fades; none under reduced motion       |

Stopped, the autoplay toggle looks like Prev and Next; playing, it is filled
with the accent, paused by a pointer or not. With a light `--deck-accent`, set
`--deck-control-active-color` too, so its text keeps 4.5:1 contrast.

In forced colours mode, dots are drawn in system colours, the current one and
a hovered one highlighted, and so is the playing toggle.
