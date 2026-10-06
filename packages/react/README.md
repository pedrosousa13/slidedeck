# @slidedeck/react

A headless carousel for React 19 built on native CSS scroll snap. The browser
scrolls, with its own momentum, snapping and focus scrolling; slidedeck tracks
where the deck rests and asks the browser to move. You compose the deck from
primitives that work with no stylesheet, and style it with plain CSS.

- [Install](#install)
- [Quickstart](#quickstart)
- [Primitives](#primitives)
- [Hooks](#hooks)
- [Layout is CSS](#layout-is-css)
- [The index: controlled, uncontrolled and the handle](#the-index-controlled-uncontrolled-and-the-handle)
- [Focal slide](#focal-slide)
- [Loop](#loop)
- [Drag](#drag)
- [Autoplay](#autoplay)
- [Vertical and right-to-left](#vertical-and-right-to-left)
- [Pages](#pages)
- [Progress and data attributes](#progress-and-data-attributes)
- [Effects: fade and curve](#effects-fade-and-curve)
- [Theme](#theme)
- [Server rendering](#server-rendering)
- [Accessibility](#accessibility)
- [Known limits](#known-limits)
- [Recipes](#recipes)
- [Comparison with Embla and Keen](#comparison-with-embla-and-keen)

## Install

```sh
pnpm add @slidedeck/react
```

`react` and `react-dom` 19 are peer dependencies. `@slidedeck/react` is the
only package to install; it brings `@slidedeck/core`, the engine. The package
is ESM only.

## Quickstart

```tsx
import * as Deck from '@slidedeck/react';

export function Featured() {
  return (
    <Deck.Root aria-label="Featured products">
      <Deck.Viewport>
        <Deck.Slide>Slide one</Deck.Slide>
        <Deck.Slide>Slide two</Deck.Slide>
        <Deck.Slide>Slide three</Deck.Slide>
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
      <Deck.Dots />
      <Deck.Counter />
    </Deck.Root>
  );
}
```

That is a working deck: one full-width slide per snap point, Prev and Next
buttons, a dot per page and a "1 / 3" counter. No stylesheet is needed. Give
`Deck.Root` an `aria-label`: it names the carousel region.

## Primitives

Each primitive passes its other props, `ref`, `className` and `style`
included, to the element in the table. Some render more inside it:
`Deck.Root` a visually hidden live region, `Deck.Viewport` a `<style>` with
the slides' default geometry and, with an effect such as fade, an empty snap
target per slide, and `Deck.Dots` its buttons.

| Primitive             | Renders    | What it does                                                                                                                                                                 |
| --------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Deck.Root`           | `<div>`    | The deck: a region with `aria-roledescription="carousel"`, the deck's state and a polite live region. Holds the props below.                                                 |
| `Deck.Viewport`       | `<div>`    | The native scroll container. Its children are the slides. Focusable, so the arrow keys scroll it. Takes `effect`.                                                            |
| `Deck.Slide`          | `<div>`    | One slide, a group labelled "n of m". Its size and alignment are your CSS.                                                                                                   |
| `Deck.Prev`           | `<button>` | Moves one snap point back. Disabled at the first unless the deck loops. Its text is "Previous" unless you pass children.                                                     |
| `Deck.Next`           | `<button>` | Moves one snap point on. Disabled at the last unless the deck loops. Its text is "Next" unless you pass children.                                                            |
| `Deck.Dots`           | `<div>`    | A group labelled "Choose page" with one button per page, "Go to page n"; the current one has `aria-current="true"`. Style the buttons with `[data-slidedeck-dots] > button`. |
| `Deck.Counter`        | `<span>`   | The current page and the total, as "3 / 10".                                                                                                                                 |
| `Deck.AutoplayToggle` | `<button>` | Stops and starts autoplay: "Stop slide rotation" or "Start slide rotation". Renders only on a deck with `autoplay`.                                                          |

Prev, Next, Dots, Counter and AutoplayToggle render nothing when every slide
fits in the viewport, as there is nowhere to go. A consumer's `onClick` on
Prev, Next or AutoplayToggle runs first and can cancel the move with
`event.preventDefault()`.

`Deck.Root` props, besides those of a `<div>`:

| Prop            | Type                         | Default        | What it does                                                                              |
| --------------- | ---------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| `defaultIndex`  | `number`                     | `0`            | The snap point to start at. Read once, on mount.                                          |
| `index`         | `number`                     |                | The snap point to rest at, controlled. Not with `defaultIndex`.                           |
| `onIndexChange` | `(index: number) => void`    |                | Called once each time the deck settles on a new snap point.                               |
| `handleRef`     | `Ref<RootHandle>`            |                | Receives `scrollTo(index)`, `next()` and `prev()`.                                        |
| `onFocalChange` | `(slide: number) => void`    |                | Called once each time the focal slide changes, with its index, or -1 when no slide snaps. |
| `clickToFocus`  | `boolean`                    | `false`        | Clicking a slide brings it to the focal position.                                         |
| `loop`          | `boolean`                    | `false`        | Past the last snap point is the first, and back.                                          |
| `drag`          | `boolean`                    | `true`         | A mouse can drag the deck.                                                                |
| `autoplay`      | `number`                     |                | Moves one snap point on every this many milliseconds. Off when unset.                     |
| `orientation`   | `'horizontal' \| 'vertical'` | `'horizontal'` | The axis the deck scrolls along.                                                          |

The package also exports the types `RootProps`, `RootHandle`,
`ViewportProps`, `UseDeckResult` (what `useDeck` returns), `UseSlideResult`
(what `useSlide` returns), `Effect` and `Orientation`.

## Hooks

`Deck.useDeck()`, called by any component inside `Deck.Root`, gives it the
deck's state and moves, so you can build Prev, Next, a counter or pagination
from your own components. It returns:

- `index`: the current index, the snap point the deck rests at, so a page
  when the deck snaps in pages.
- `count`: the number of snap points, or `null` until the viewport is
  measured, as on the server.
- `loop`: whether `Deck.Root` has `loop`.
- `fits`: whether every slide fits, where the built-in controls are absent.
- `canPrev` and `canNext`: whether `Deck.Prev` and `Deck.Next` are enabled.
- `scrollTo(index)`, `next()` and `prev()`: the moves of `RootHandle`. Each
  stops autoplay, as a built-in control does.

The values are the ones the built-in controls read, so your control and
theirs agree. The hook never re-renders while the deck scrolls. It re-renders
whenever `Deck.Root` does: when the deck settles somewhere new, when the
number of snap points changes and, on a deck with `autoplay`, when autoplay
starts, stops, or pauses for a pointer or a hidden tab. Called outside a
`Deck.Root`, it throws. For a full set, with a button per page, see
[custom controls and a counter](#recipe-custom-controls-and-a-counter).

```tsx
import type { ReactNode } from 'react';
import * as Deck from '@slidedeck/react';

// Your design system's button.
declare function Button(props: {
  isDisabled: boolean;
  onPress: () => void;
  children: ReactNode;
}): ReactNode;

const twoDigits = (n: number) => String(n).padStart(2, '0');

function PhotoControls() {
  const { index, count, fits, canPrev, canNext, prev, next } = Deck.useDeck();
  if (fits) return null;
  return (
    <div className="photo-controls">
      <Button isDisabled={!canPrev} onPress={prev}>
        Previous photo
      </Button>
      {/* "03 — 10" */}
      <span>
        {count !== null && `${twoDigits(index + 1)} — ${twoDigits(count)}`}
      </span>
      <Button isDisabled={!canNext} onPress={next}>
        Next photo
      </Button>
    </div>
  );
}

export function Photos() {
  return (
    <Deck.Root aria-label="Photos">
      <Deck.Viewport>
        <Deck.Slide>One</Deck.Slide>
        <Deck.Slide>Two</Deck.Slide>
        <Deck.Slide>Three</Deck.Slide>
      </Deck.Viewport>
      <PhotoControls />
    </Deck.Root>
  );
}
```

`Deck.useSlide()`, called by content inside a slide, tells it which slide it
is in. It returns `{ index, copy }`: `index` is the slide's index, also inside
a loop's copy of it, and `copy` is `'before'` or `'after'` in a copy, the side
of the slides it is on, and `undefined` in a slide. Use it where stateful
content must not run twice, as in the
[playdeck recipe](#recipe-play-a-playdeck-video-in-the-focal-slide). Called
outside a `Deck.Slide`, it throws.

## Layout is CSS

Slides per view, gap, alignment and their breakpoints are plain CSS, never
props. By default each slide is as wide as the viewport and snaps at its
start. These defaults have zero specificity, so any rule of yours wins:

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

Media queries and container queries work as they do for anything else, and
the deck re-reads its snap points when the viewport resizes. The structural
styles a deck needs, such as the scroll container and its snap type, are set
inline on the primitives; your `style` prop is spread after them.

Centred slides rest with the first slide at the start edge, as the viewport
cannot scroll before it. To centre the first and last slides too, see
[centre the first and last slide](#recipe-centre-the-first-and-last-slide).

## The index: controlled, uncontrolled and the handle

The current index is the snap point the viewport rests at. Uncontrolled, pass
`defaultIndex` and read changes with `onIndexChange`. Controlled, pass
`index` and `onIndexChange`, as with a React input's `value`:

```tsx
import { useState } from 'react';
import * as Deck from '@slidedeck/react';

export function Controlled() {
  const [index, setIndex] = useState(0);
  return (
    <>
      <Deck.Root aria-label="Photos" index={index} onIndexChange={setIndex}>
        <Deck.Viewport>
          <Deck.Slide>One</Deck.Slide>
          <Deck.Slide>Two</Deck.Slide>
          <Deck.Slide>Three</Deck.Slide>
        </Deck.Viewport>
      </Deck.Root>
      <button type="button" onClick={() => setIndex(2)}>
        Last photo
      </button>
    </>
  );
}
```

A controlled deck scrolls to a new `index`. A scroll that settles elsewhere
calls `onIndexChange`, and the deck returns to `index` unless the parent takes
the new one. `index` without `onIndexChange` compiles, as a read-only input,
and warns in development. `index` with `defaultIndex` is a type error. Two
decks that share one `index` state stay in step, as a main deck and its
thumbnail strip do.

For event handlers that should not go through state, `handleRef` gives the
deck's moves:

```tsx
import { useRef } from 'react';
import * as Deck from '@slidedeck/react';

export function WithHandle() {
  const deck = useRef<Deck.RootHandle>(null);
  return (
    <>
      <Deck.Root aria-label="Steps" handleRef={deck}>
        <Deck.Viewport>
          <Deck.Slide>One</Deck.Slide>
          <Deck.Slide>Two</Deck.Slide>
        </Deck.Viewport>
      </Deck.Root>
      <button type="button" onClick={() => deck.current?.scrollTo(0)}>
        Back to the start
      </button>
    </>
  );
}
```

`scrollTo` clamps to the snap points there are. `ref` stays the region
element, as on every primitive. With pages, the index counts pages.

`onIndexChange` and `onFocalChange` fire only when a scroll settles, never
during one, and not for where the deck starts. Scrolling never re-renders:
React state changes when the deck settles somewhere new (the index, the
current and focal slides, the live region's announcement), when the number
of snap points changes, and, on a deck with `autoplay`, when autoplay starts,
stops, or pauses for a pointer or a hidden tab.

## Focal slide

The focal slide is the slide at the snap alignment point, the one the deck is
about. With one slide in view it is the current slide; with several in view,
centred, it is the middle one. It carries `data-focal`, and `onFocalChange`
reports it. The current slide, the first slide resting at the current snap
point, carries `data-current`.

The focal slide is defined by the alignment point, not by which slides are in
view: with several in view at the start, it is the first of them. To highlight
the middle one, see
[highlight the middle slide in view](#recipe-highlight-the-middle-slide-in-view).

With `clickToFocus`, clicking a slide brings it to the focal position, as near
as the scroll range allows. A click that ends a mouse drag does not, nor does
a keyboard click on a control in a slide.

## Loop

`loop` makes the deck run on past the last snap point to the first, and back,
with no visible jump. Prev and Next are then never disabled, and a drag, flick
or wheel crosses the seam. `Deck.Viewport` renders a copy of every slide on
each side of the slides, `inert` and `aria-hidden`; once the deck rests on a
copy, it jumps to the identical slide. Indexes, Dots, Counter, `data-current`
and `data-focal` count the slides only, never the copies. `scrollTo`, Dots
and a new controlled `index` go the direct way, within the slides. A deck
whose slides all fit does not loop. Content that must not run twice, such as
a video player, can render differently in a copy with `Deck.useSlide()`. See
[Known limits](#known-limits).

## Drag

A mouse can drag the deck by default. Snapping is off while it drags; on
release the deck projects the flick's velocity to a snap point and settles
there. A drag never clicks what it started on; a plain click still does.
Touch, pen and trackpad always scroll natively. Set `drag={false}` for decks
whose content is itself draggable.

## Autoplay

`autoplay={5000}` moves the deck one snap point on every 5 seconds, counted
from when it comes to rest. It stops at the last snap point unless the deck
loops. Pair it with `Deck.AutoplayToggle`, placed first among the deck's
controls, so motion can always be stopped (WCAG 2.2.2):

```tsx
import * as Deck from '@slidedeck/react';

export function Hero() {
  return (
    <Deck.Root aria-label="Highlights" autoplay={5000} loop>
      <Deck.AutoplayToggle />
      <Deck.Viewport>
        <Deck.Slide>One</Deck.Slide>
        <Deck.Slide>Two</Deck.Slide>
        <Deck.Slide>Three</Deck.Slide>
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
    </Deck.Root>
  );
}
```

- A pointer over the deck, or a hidden tab, pauses it.
- Focus entering the deck, other than on the toggle, or the user moving the
  deck, stops it until the toggle starts it again.
- A preference for reduced motion stops it from the start.
- Moves autoplay makes are not announced, and the live region is off while
  it rotates.

The toggle carries `data-playing` while autoplay is on. Children replace its
text: give both states and show one with `[data-playing]` in CSS. Starting it
again where it stopped at the last snap point goes back to the first. To
autoplay on some screens only, see
[change `effect`, `loop` or `autoplay` per breakpoint](#recipe-change-effect-loop-or-autoplay-per-breakpoint).

## Vertical and right-to-left

`orientation="vertical"` scrolls along the block axis. A vertical deck needs a
height, set on `Deck.Viewport` in CSS; each slide fills it by default.

Writing direction is read from the document's computed `direction`, so `dir`
on any ancestor applies. In a right-to-left document the deck starts at the
right, Next moves toward the inline end on the left, and a mouse drag and the
arrow keys follow.

A deck follows a change of `dir` after it mounts, as a locale switch makes:
it stays on its slide, and from there goes the new way. A change of
`direction` in CSS alone is not watched, and a deck inside a shadow root does
not see a change of `dir` on its ancestors outside it.

## Pages

To snap in groups, make only the first slide of each group a snap point. Next
then moves a page, and Dots and Counter count pages:

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

## Progress and data attributes

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

## Effects: fade and curve

An effect is a value passed to `Deck.Viewport`'s `effect`, imported from its
own entry point. A deck that imports none ships none of their code. The
viewport keeps scrolling, snapping and dragging natively under both.

```tsx
import * as Deck from '@slidedeck/react';
import { curve } from '@slidedeck/react/curve';
import { fade } from '@slidedeck/react/fade';

export function Effects() {
  return (
    <>
      <Deck.Root aria-label="Crossfade">
        <Deck.Viewport effect={fade}>
          <Deck.Slide>One</Deck.Slide>
          <Deck.Slide>Two</Deck.Slide>
        </Deck.Viewport>
        <Deck.Prev />
        <Deck.Next />
      </Deck.Root>
      <Deck.Root aria-label="Showcase">
        <Deck.Viewport effect={curve}>
          <Deck.Slide>
            <div className="card">One</div>
          </Deck.Slide>
          <Deck.Slide>
            <div className="card">Two</div>
          </Deck.Slide>
        </Deck.Viewport>
      </Deck.Root>
    </>
  );
}
```

**Fade** stacks the slides in one place and crossfades them by progress. Each
slide fills the viewport and snaps at its start, so slide width, alignment and
pages do not apply: a fade shows one slide at a time. Every slide but the
focal one is `inert`. Under reduced motion it cuts from one slide to the next
halfway instead of fading.

**Curve** fans the slides along an arc around the focal slide and fades them
with their distance from it. The slides keep their size, gap, alignment and
pages. The arc is drawn on each slide's children, so give each slide one child
that fills it, styled as the slide is seen. The radius, in slides, is
`--deck-curve-radius` (default 4), set in CSS on the viewport. Each curve slide
has `contain: layout`, so a `position: fixed` element inside it is placed
against the slide. Under reduced motion the content stays flat and only fades.
To turn a radius in pixels into slides and leave the arc room in the
viewport, see [size a curve](#recipe-size-a-curve).

Both effects' styles are zero-specificity rules on `--deck-slide-progress`, so
your CSS overrides any of them. To use an effect on some screens only, see
[change `effect`, `loop` or `autoplay` per breakpoint](#recipe-change-effect-loop-or-autoplay-per-breakpoint).

## Theme

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

## Server rendering

The primitives render on the server. Server HTML rests at `defaultIndex`
before any script runs where the browser supports `scroll-initial-target`;
elsewhere a layout effect moves there before the first paint. Either way there
is no layout shift with one slide per snap point.

The server cannot measure, so it renders Prev and Next, and Dots and Counter
with one page per slide. Hydration corrects them where that is wrong: it
removes the controls when every slide fits, and recounts Dots and Counter when
several slides share a snap point or the deck snaps in pages. Where `Deck.Root`
cannot see the slides ahead of time, as when `Deck.Viewport` sits inside your
own component, Dots and Counter render empty until hydration. `useDeck()`
reports a `count` of `null` on the server, so a counter built on it renders
its total at hydration.

The package has no `'use client'` directive: in a React Server Components
framework, render the deck from a client component.

## Accessibility

What a deck does with no extra work:

- `Deck.Root` is a region with `aria-roledescription="carousel"`, named by
  your `aria-label`.
- Each slide is a group with `aria-roledescription="slide"`, labelled "n of
  m".
- Prev, Next, the dots and the toggle are native buttons with names. Dots are
  a labelled group of buttons with `aria-current`, not tabs, since a dot can
  stand for a page of several slides.
- A polite live region announces "Slide n of m" after a move the user makes;
  it is off while autoplay rotates the deck.
- No slide is hidden or `inert` for being off-screen. Tabbing into an
  off-screen slide scrolls it into view natively, and snap settles it; during
  a move, the deck goes to the snap point of that slide's page instead.
- The viewport is focusable, so the arrow keys, Page Up, Page Down, Home and
  End scroll it.
- Loop copies are `inert` and `aria-hidden`: never focused, never announced.
- Under reduced motion, a move slidedeck starts (Prev, Next, a dot,
  `scrollTo`, a new `index`, a drag's release) jumps to its snap point instead
  of scrolling smoothly; autoplay starts stopped; fade cuts and curve stays
  flat.

One exception: in a fade deck, every slide but the focal one is `inert`, as it
sits under the focal one. Keyboard and screen reader users reach the slides
through Prev, Next, Dots and the arrow keys.

## Known limits

- **A loop copy renders the slide's children again.** Their state is their
  own, effects and refs in them run once per copy, and an `id` inside a slide
  repeats three times. Avoid `id`s in looping slides, or make them unique
  outside the slide. `Deck.useSlide()` tells content whether it is in a copy.
- **Presses beyond the reachable copies are dropped.** A step goes at most a
  set of copies past either end. When presses come faster than the deck
  moves, the deck passes fewer slides than were pressed, rather than moving
  against a press or jumping mid-motion. At rest, a press always moves it one
  snap point.
- **Fade ignores slide geometry.** Slide width, alignment and pages do not
  apply to a fade deck.
- **Curve draws on the slides' children**, not the slide box: a slide's own
  background and border stay flat.
- **Server HTML can only start at a slide.** With several slides per snap
  point, or pages, the first paint at a `defaultIndex` may correct after
  hydration, and Dots and Counter recount.
- **A controlled index counts pages**, so a breakpoint that changes the page
  size points the same index at different slides.
- **A long task can let Chromium undo a wheel.** When a long task holds the
  main thread just after a wheel during a move, Chromium can carry the move
  on to its slide, against the wheel. The deck still rests on a snap point.
- **Touch flicks across a loop's seam are not covered by automated tests**;
  they are checked by hand on a phone and a trackpad.

## Recipes

Common setups that are CSS or a little of your own code, not options. Each
runs in a story in this repo's storybook, named at the end of the recipe. In
the CSS, `.products` and `.showcase` are classes on `Deck.Root`.

- [Centre the first and last slide](#recipe-centre-the-first-and-last-slide)
- [Highlight the middle slide in view](#recipe-highlight-the-middle-slide-in-view)
- [Size a curve](#recipe-size-a-curve)
- [Custom controls and a counter](#recipe-custom-controls-and-a-counter)
- [Change `effect`, `loop` or `autoplay` per breakpoint](#recipe-change-effect-loop-or-autoplay-per-breakpoint)
- [Play a playdeck video in the focal slide](#recipe-play-a-playdeck-video-in-the-focal-slide)

## Recipe: centre the first and last slide

With `scroll-snap-align: center`, the first slide cannot reach the centre of
the viewport, which cannot scroll before the slide's start: the deck rests
with the first slide at the start edge, and the slide nearest the centre is
focal. The last slide is the same at the end. Without `loop`, pad the viewport
at each end by half its width less half a slide, so the scroll range runs far
enough:

<!-- example: apps/storybook/stories/recipes/centred-ends.css -->

```css
/* Slides 280px wide, 16px apart, each centred, the first and last too. */
.products {
  --slide-width: 280px;
}
.products [data-slidedeck-viewport] {
  gap: 16px;
  /* Half the viewport less half a slide, at each end. */
  padding-inline: calc(50% - var(--slide-width) / 2);
}
.products [data-slidedeck-slide] {
  width: var(--slide-width);
  scroll-snap-align: center;
}
```

Give the slides a width that is not a percentage, such as `px`, `rem` or `vw`:
the padding's percentage is of the deck's width, and a slide's is of the
viewport's content box, which the padding narrows. With `loop`, the copies
either side already let the first and last slides reach the centre.

The story is `Recipes / Centred Ends`. An end-to-end test checks that the deck
rests with the first slide centred, and the last after a move to it.

## Recipe: highlight the middle slide in view

The focal slide is the slide at the snap alignment point (see
[Focal slide](#focal-slide)), not the middle of the slides in view. With the
default `scroll-snap-align: start`, it is the first slide in view. There are
two ways to highlight the middle one, here of three in view. Both outline it
rather than dim the others, which would lower their text's contrast.

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
padding of [centre the first and last slide](#recipe-centre-the-first-and-last-slide)
to let the first and last slides reach the middle.

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

## Recipe: size a curve

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

## Recipe: custom controls and a counter

`Deck.useDeck()` (see [Hooks](#hooks)) gives your own components what the
built-in controls read. Here Previous, Next, a button per page and a counter
are built from a design system's button, whose API is not a native button's:

<!-- example: apps/storybook/stories/recipes/custom-controls.tsx -->

```tsx
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
```

They do what the built-in controls do:

- They render nothing when every slide fits.
- Previous and Next are disabled at the ends, unless the deck loops.
- The page buttons are a group labelled "Choose page", the current page's
  marked `aria-current`, as `Deck.Dots`. There are none until the deck is
  measured: `count` is `null` on the server.
- `Deck.Root`'s live region still announces the slide the deck moves to, so
  the counter needs no live region of its own.
- A move stops autoplay, as a move with a built-in control does.

The story is `Recipes / Custom Controls`, where `./design-system` is a
stand-in.

## Recipe: change `effect`, `loop` or `autoplay` per breakpoint

A prop cannot read a media query, so read it in your component and pass the
props it picks. A deck takes a new `effect`, `loop` or `autoplay` after it
mounts: it stays at its current index, at rest on its snap point, and
announces nothing. A move in flight still ends where it was going. Where the
new layout has fewer snap points than the index needs, the deck rests on the
last one and reports it, through `onIndexChange` and the live region. Here a
narrow screen crossfades one slide at a time, and from 768px the deck shows
three slides and loops:

<!-- example: apps/storybook/stories/recipes/responsive-deck.tsx -->

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

<!-- example: apps/storybook/stories/recipes/responsive-deck.css -->

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
- The deck keeps its index, not its slide. With [pages](#pages), an index is
  a page, so on the side of the breakpoint that pages, the same index shows
  other slides than on the side that fades.

The story is `Recipes / Per Breakpoint`. An end-to-end test resizes the window
across 768px both ways and checks that the deck stays on its slide, with no
index reported and nothing announced.

## Recipe: play a playdeck video in the focal slide

A social-style deck of videos: the video in the focal slide plays, muted, and
the others pause. Each slide holds a [playdeck](https://www.npmjs.com/package/@playdeck/react)
player; `onFocalChange` tells the deck's parent which slide is focal once a
scroll settles, and each player's handle plays or pauses it. It works with
`loop`, as a feed usually is.

```sh
pnpm add @playdeck/react
```

<!-- example: apps/storybook/stories/video-deck.tsx -->

```tsx
import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  type Ref
} from 'react';
import * as Deck from '@slidedeck/react';
import * as Player from '@playdeck/react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** A deck of videos: the one in the focal slide plays, muted; the rest pause.
 * Under reduced motion none plays by itself; a viewer can still press play. */
export function VideoDeck({
  sources,
  loop = false,
  ref
}: {
  sources: readonly string[];
  loop?: boolean;
  /** Each slide's player handle, by slide index, null while unmounted. */
  ref?: Ref<readonly (Player.PlayerHandle | null)[]>;
}) {
  const players = useRef<(Player.PlayerHandle | null)[]>([]);
  const focal = useRef(0);
  useImperativeHandle(ref, () => players.current, []);

  const playFocal = (slide: number) => {
    focal.current = slide;
    const still = () => matchMedia(REDUCED_MOTION).matches;
    players.current.forEach((player, i) => {
      if (i !== slide || still()) void player?.pause();
    });
    if (still()) return;
    // A player loads as its slide comes into view: wait until it can play,
    // and play only if its slide is still the focal one.
    const player = players.current[slide];
    void player?.whenReady().then((ready) => {
      if (ready && focal.current === slide && !still()) void player.play();
    });
  };

  // onFocalChange does not fire for where the deck starts, nor when the
  // viewer's motion preference changes: play or pause for both.
  const replay = useEffectEvent(() => playFocal(focal.current));
  useEffect(() => {
    const query = matchMedia(REDUCED_MOTION);
    const onChange = () => replay();
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return (
    <Deck.Root
      aria-label="Featured slides"
      onFocalChange={playFocal}
      loop={loop}
    >
      <Deck.Viewport>
        {sources.map((source, i) => (
          <Deck.Slide key={i}>
            <SlideVideo
              source={source}
              register={(slide, player) => {
                players.current[slide] = player;
              }}
            />
          </Deck.Slide>
        ))}
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
    </Deck.Root>
  );
}

/** A slide's player, registered by the slide's index. A loop's copy renders
 * the slide again: it shows the video's first frame, still, and registers
 * nothing, so it never replaces or clears the slide's player. */
function SlideVideo({
  source,
  register
}: {
  source: string;
  register: (slide: number, player: Player.PlayerHandle | null) => void;
}) {
  const { index, copy } = Deck.useSlide();
  if (copy) {
    return (
      <video
        // A start time, as a media fragment, makes Safari load and paint the
        // first frame too, where metadata alone shows nothing.
        src={`${source}#t=0.001`}
        muted
        playsInline
        preload="metadata"
        style={{
          display: 'block',
          width: '100%',
          aspectRatio: '16 / 9',
          objectFit: 'contain'
        }}
      />
    );
  }
  return (
    <Player.Root
      ref={(player) => register(index, player)}
      source={source}
      defaultMuted
      loop
    >
      <Player.Viewport style={{ aspectRatio: '16 / 9' }}>
        <Player.Media />
        <Player.Controls>
          <Player.PlayButton />
        </Player.Controls>
      </Player.Viewport>
    </Player.Root>
  );
}
```

Show part of the next slide so the deck reads as a feed:

```css
[data-slidedeck-viewport] {
  gap: 16px;
}
[data-slidedeck-slide] {
  width: 80%;
}
```

Notes:

- The videos are muted so the browser lets them play without a gesture. Each
  keeps playdeck's own play button, so a viewer can pause the one playing.
- Under reduced motion no video plays by itself, and turning the preference
  on pauses the one playing; a viewer can still press play. Playdeck applies
  reduced motion only to its own `autoplay`, not to `play()` called from code,
  so the recipe checks `prefers-reduced-motion` itself.
- A playdeck player loads when it comes into view. `whenReady` waits for that,
  and the focal check stops a late load from playing a slide the deck has
  left.
- With `loop`, the deck renders each slide again in its copies. Each
  slide's content calls `Deck.useSlide()`: a slide registers its player by
  its index, and a copy shows the video's first frame, still, and registers
  nothing. No copy's player can replace or clear a slide's, and the focal
  slide's video plays once the deck crosses the seam and jumps.
- `VideoDeck`'s `ref` gives its parent the player handles, by slide index.

The stories `Deck / Playdeck Video` and `Deck / Playdeck Video Loop` in this
repo's storybook run this component, and end-to-end tests check that only the
focal slide's video plays, across a loop's seam both ways too, and that none
plays under reduced motion.

## Comparison with Embla and Keen

Embla and Keen move slides with transforms and their own physics; slidedeck
lets the browser scroll. The size column is measured by `pnpm compare` from
pinned installs, and CI fails if this table is stale.

<!-- comparison:start -->

<!-- Generated by `pnpm compare` from tests/compare. Do not edit. -->

| Library                | Version   | Min+gzip | Native scroll                                    | Accessibility out of the box                                                                                                           | API shape                                                                                          |
| ---------------------- | --------- | -------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `@slidedeck/react`     | this repo | 7.81 KB  | Yes: CSS scroll snap in a real scroll container  | Labelled carousel region, slides labelled "n of m", button controls, dots with `aria-current`, a polite live region, loop copies inert | Components (`Deck.Root`, `Deck.Viewport`, `Deck.Slide`, controls), controlled `index` and a handle |
| `embla-carousel-react` | 8.6.0     | 7.61 KB  | No: `translate3d` transforms and its own physics | No roles, labels or controls; scrolls a focused slide into view                                                                        | A hook returning a ref and an API object; markup and controls are yours                            |
| `keen-slider`          | 6.8.6     | 6.61 KB  | No: `translate3d` transforms and its own physics | No roles, labels, controls or keyboard handling                                                                                        | A hook returning a ref and an instance, plus a required stylesheet; markup and controls are yours  |

Min+gzip: each entry in `tests/compare/entries` is the same basic deck for all three, three slides with Previous and Next and no dots, bundled by Vite 8.3.1 with React external, minified, then gzipped, with the stylesheet the library needs. Each imports what its library documents: Keen's `keen-slider/react` has no exports map and resolves to its CommonJS build. Slidedeck's row is measured from this repo's build, so it has no version. The other columns, and where each was read:

- `@slidedeck/react`: packages/react/src/index.tsx; docs/adr/0001-native-scroll-snap-is-the-engine.md; docs/adr/0004-dots-are-buttons.md.
- `embla-carousel-react`: embla-carousel 8.6.0 `esm/embla-carousel.esm.js`: sets `transform: translate3d(…)`, no `aria-` or `role`, a `slideFocus` handler; embla-carousel-react 8.6.0 `esm/embla-carousel-react.esm.js`: exports the `useEmblaCarousel` hook; the accessibility cell is for 8.6.0: Embla v9, in prerelease, adds an optional `embla-carousel-accessibility` plugin (9.0.0-rc01 to rc03 on npm).
- `keen-slider`: keen-slider 6.8.6 `react.js`: sets `translate3d(…)`, no `aria-`, `role` or `keydown`; exports the `useKeenSlider` hook; keen-slider 6.8.6 `keen-slider.css`: the `display: flex` and `overflow: hidden` the slider needs.

<!-- comparison:end -->

## License

MIT
