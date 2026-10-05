import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  use,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject
} from 'react';
import {
  COPY,
  createDeck,
  SNAP_TARGET,
  type DeckEngine,
  type Orientation
} from '@slidedeck/core';

export type { Orientation };

// Left in the build for the consumer's bundler to replace, as React's own
// development checks are, so production bundles drop the warnings.
declare const process: { env: { NODE_ENV?: string } };

interface DeckContextValue {
  index: number;
  /** Snap point count; null until the viewport has been measured. */
  count: number | null;
  /** The current slide; null until the viewport has been measured. */
  slide: number | null;
  /** The focal slide; null until the viewport has been measured. */
  focal: number | null;
  /** The slides in Deck.Viewport, for the first render only, before any
   * measurement: Dots and Counter then count a page per slide. Null after, or
   * where Root cannot see Viewport's children. */
  slides: number | null;
  initialIndex: number;
  orientation: Orientation;
  /** Whether Root has `loop`. */
  loop: boolean;
  viewportRef: RefObject<HTMLDivElement | null>;
  engineRef: RefObject<DeckEngine | null>;
  /** Whether Root has `autoplay`. */
  hasAutoplay: boolean;
  /** Whether autoplay is on: the user has not stopped it. A pointer over the
   * deck or a hidden document pauses it without turning it off. */
  playing: boolean;
  /** Turns autoplay on or off, as the user does with the toggle. */
  togglePlaying(): void;
  /** The engine, for a move the user makes with a control: stops autoplay. */
  userMove(): DeckEngine | null;
}

const clampSlide = (index: number, count: number) =>
  Math.min(Math.max(index, 0), count - 1);

const DeckContext = createContext<DeckContextValue | null>(null);

function useDeck(primitive: string): DeckContextValue {
  const deck = use(DeckContext);
  if (!deck) throw new Error(`Deck.${primitive} must be inside Deck.Root`);
  return deck;
}

/** What `Deck.Root`'s `handleRef` exposes: moves for event handlers that
 * should not round-trip through state. Each fires `onIndexChange` when the deck
 * settles on a new snap point. */
export interface RootHandle {
  /** Scrolls to a snap point, clamped to the snap points there are. */
  scrollTo(index: number): void;
  /** Scrolls one snap point on. */
  next(): void;
  /** Scrolls one snap point back. */
  prev(): void;
}

interface RootBaseProps extends ComponentProps<'div'> {
  /** The deck's moves; `ref` is the region element, as on every primitive. */
  handleRef?: Ref<RootHandle>;
  /** Whether a mouse can drag the deck, settling on a snap point when it lets
   * go. A drag never clicks what it started on. Touch, pen and trackpad
   * always scroll natively. Defaults to true. */
  drag?: boolean;
  /** Called once each time the focal slide changes, with its slide index,
   * or -1 when no slide snaps: when a scroll settles, never during one, and
   * not for where the deck starts. */
  onFocalChange?: (slide: number) => void;
  /** Whether clicking a slide brings it to the focal position, as near as
   * the scroll range allows; with pages, its page. A click that ends a mouse
   * drag does not, nor does a keyboard click (Enter or Space on a control),
   * nor a programmatic `element.click()` (detail 0): call `scrollTo` on the
   * handle instead. Defaults to false. */
  clickToFocus?: boolean;
  /** The axis the deck scrolls along. A vertical deck needs a height, set on
   * `Deck.Viewport` in CSS. Horizontal follows the writing direction: in a
   * right-to-left document the deck starts at the right and Next moves left.
   * Defaults to horizontal. */
  orientation?: Orientation;
  /** Whether scrolling past the last snap point arrives at the first, and
   * back, with no visible jump: Prev and Next are then never disabled.
   * `Deck.Viewport` renders a copy of every slide on each side of the
   * slides, inert and `aria-hidden`, and the deck jumps from a copy to its
   * slide once it rests (clone and jump, ADR-0006, as built in ADR-0009).
   * Indexes, Dots and Counter count the slides' snap points only, never the
   * copies'. A copy renders the slide's children again, so their state is
   * their own and an `id` in a slide repeats. A deck whose slides all fit
   * does not loop and renders no copies. Defaults to false. */
  loop?: boolean;
  /** Moves the deck one snap point on every this many milliseconds, counted
   * from when it comes to rest, and stops at the last, unless the deck
   * loops, or where a step leaves the deck where it was, as when a
   * controlled parent refuses it. A pointer over the deck or a hidden
   * document pauses it; focus entering the deck, other than on
   * `Deck.AutoplayToggle`, or the user moving it stops it until the toggle
   * starts it again, and so does a preference for reduced motion, from the
   * start. Pair it with `Deck.AutoplayToggle` (WCAG 2.2.2). Off by default. */
  autoplay?: number;
}

/** Controlled like a React input's `value`: the deck scrolls to `index` when
 * it changes. A scroll that settles elsewhere calls `onIndexChange`, and the
 * deck returns to `index` unless the parent takes the new one. */
interface ControlledProps {
  /** The snap point to rest at. */
  index: number;
  defaultIndex?: never;
  /** Called once each time the viewport settles on a new snap point other
   * than `index`; never for a move to `index`. Without it, every scroll returns
   * to `index`, and development warns. */
  onIndexChange?: (index: number) => void;
}

interface UncontrolledProps {
  index?: never;
  /** The snap point to start at, clamped to the snap points there are.
   * Read once, on mount. */
  defaultIndex?: number;
  /** Called once each time the viewport settles on a new snap point. */
  onIndexChange?: (index: number) => void;
}

export type RootProps = RootBaseProps & (ControlledProps | UncontrolledProps);

/** One deck: a labelled carousel region holding a viewport, its controls and
 * a live region announcing the slide the user moves it to. */
export function Root({
  index,
  defaultIndex,
  onIndexChange,
  handleRef,
  drag = true,
  onFocalChange,
  clickToFocus = false,
  orientation = 'horizontal',
  loop = false,
  autoplay,
  children,
  onFocus,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onKeyDown,
  onWheel,
  ...props
}: RootProps) {
  // Core starts a non-finite index at 0; so must the first render.
  const [initialIndex] = useState(() => {
    const start = index ?? defaultIndex ?? 0;
    return Number.isFinite(start) ? start : 0;
  });
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- the condition is constant for a build
    useDevWarnings(index, defaultIndex, onIndexChange);
  }
  const [state, setState] = useState<{
    index: number;
    count: number | null;
    slide: number | null;
    focal: number | null;
  }>({ index: initialIndex, count: null, slide: null, focal: null });
  const viewportRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DeckEngine>(null);
  const onIndexChangeRef = useRef(onIndexChange);
  const onFocalChangeRef = useRef(onFocalChange);
  const indexRef = useRef(index);
  const orientationRef = useRef(orientation);
  // What the live region says: the current slide, after the deck moves.
  const [announcement, setAnnouncement] = useState('');
  // Autoplay is on until the user, focus or reduced motion stops it; a
  // pointer over the deck or a hidden document only pauses it.
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  // Autoplay stopped because the deck could not move on: Start rewinds.
  const endedRef = useRef(false);
  // Autoplay started the deck's latest move: its settles are not announced.
  // The user's input, or an API call, takes the move over.
  const autoplayMovedRef = useRef(false);
  // Where autoplay last stepped from: resting there again, the step did not
  // move the deck. Any move autoplay did not start clears it.
  const stepFromRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    onIndexChangeRef.current = onIndexChange;
    onFocalChangeRef.current = onFocalChange;
    indexRef.current = index;
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) throw new Error('Deck.Root must contain a Deck.Viewport');
    // The first report is where the deck starts, not a change.
    let settled: number | undefined;
    let focal: number | undefined;
    const engine = createDeck(viewport, {
      index: initialIndex,
      orientation: orientationRef.current,
      onChange(next) {
        setState(next);
        // A change is a settle on a new snap point; a report of a new count
        // alone is not. Controlled, it must also be anywhere but `index`, so
        // a move to `index` never calls back.
        const controlled = indexRef.current;
        if (
          settled !== undefined &&
          next.index !== settled &&
          (controlled === undefined ||
            next.index !== clampSlide(controlled, next.count))
        ) {
          onIndexChangeRef.current?.(next.index);
        }
        if (settled !== undefined && next.index !== settled) {
          endedRef.current = false;
          // Cleared rather than kept after an autoplay move, so the user's
          // next move is announced even to the slide last announced.
          setAnnouncement(
            next.slide === -1 || autoplayMovedRef.current
              ? ''
              : `Slide ${next.slide + 1} of ${slideCount(viewport)}`
          );
        }
        settled = next.index;
        if (focal !== undefined && next.focal !== focal) {
          onFocalChangeRef.current?.(next.focal);
        }
        focal = next.focal;
      }
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [initialIndex]);

  useLayoutEffect(() => {
    engineRef.current?.setDrag(drag);
  }, [drag]);

  useLayoutEffect(() => {
    engineRef.current?.setClickToFocus(clickToFocus);
  }, [clickToFocus]);

  useLayoutEffect(() => {
    orientationRef.current = orientation;
    engineRef.current?.setOrientation(orientation);
  }, [orientation]);

  // Controlled, the deck rests at `index`: it follows a new one, and returns
  // to it after a scroll the parent did not take, as a controlled input
  // reverts an edit its parent ignores. Compared with where a scroll in
  // flight is heading, if any, so an `index` changed back mid-flight wins.
  // A new `index` is the parent's move, so it is announced; a return to
  // it belongs to the move it undoes. A looping deck follows a new `index`
  // the direct way, as `scrollTo` goes, and returns to an `index` the parent
  // kept whichever way is shorter, across the seam when that is shorter,
  // whether or not the move it undoes crossed it.
  const previousIndexRef = useRef(index);
  useLayoutEffect(() => {
    const engine = engineRef.current;
    const moved = index !== previousIndexRef.current;
    if (moved) {
      autoplayMovedRef.current = false;
      stepFromRef.current = null;
    }
    previousIndexRef.current = index;
    if (index !== undefined && state.count !== null && engine) {
      const heading = engine.target() ?? state.index;
      if (clampSlide(index, state.count) !== heading) {
        engine.scrollTo(index, moved ? 'direct' : 'short');
      }
    }
  }, [index, state.index, state.count]);

  // Autoplay's user-driven state (playing, hover, a hidden document)
  // re-renders an autoplay deck, an accepted exception in ADR-0003; scroll
  // never does. Without autoplay none of it is tracked, so nothing changes.
  const autoplaying = autoplay !== undefined;

  useLayoutEffect(() => {
    if (!autoplaying) return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const stopIfReduced = () => {
      if (query.matches) setPlaying(false);
    };
    stopIfReduced();
    query.addEventListener('change', stopIfReduced);
    return () => query.removeEventListener('change', stopIfReduced);
  }, [autoplaying]);

  useEffect(() => {
    if (!autoplaying) return;
    const update = () => setHidden(document.visibilityState === 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [autoplaying]);

  const rotating =
    autoplaying &&
    playing &&
    !hovered &&
    !hidden &&
    state.count !== null &&
    !everySlideFits(state.count);

  // One step per interval, counted afresh each time the deck comes to rest
  // on a new snap point. A step that does not bring the deck to rest on a
  // new snap point ends autoplay: at the last one, or where a controlled
  // parent refuses it. Where next() goes on from the last snap point to the
  // first, as it does with loop, it never ends.
  useEffect(() => {
    if (!rotating) return;
    let timer: ReturnType<typeof setTimeout>;
    const end = () => {
      endedRef.current = true;
      stepFromRef.current = null;
      setPlaying(false);
    };
    const tick = () => {
      const engine = engineRef.current;
      if (!engine) return;
      // A scroll the engine started is still in flight: let it rest first.
      if (engine.target() !== null) {
        timer = setTimeout(tick, autoplay);
        return;
      }
      if (stepFromRef.current === state.index) {
        end();
        return;
      }
      stepFromRef.current = state.index;
      autoplayMovedRef.current = true;
      engine.next();
      if (engine.target() === null) end();
    };
    timer = setTimeout(tick, autoplay);
    return () => clearTimeout(timer);
  }, [rotating, autoplay, state.index]);

  const togglePlaying = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    stepFromRef.current = null;
    if (endedRef.current) {
      endedRef.current = false;
      autoplayMovedRef.current = true;
      engineRef.current?.scrollTo(0);
    }
    setPlaying(true);
  };

  // The user's input anywhere in the deck but the toggle takes over the
  // deck's move, so its settle is announced. In the viewport, where a press,
  // wheel or key moves the deck, it also stops autoplay, as focus entering
  // the deck does, whatever the pointer type. Prev, Next and Dots stop it
  // when activated, as Safari does not focus a button on click.
  const userInput = ({ target }: { target: EventTarget }) => {
    const element = target as Element;
    if (element.closest('[data-slidedeck-autoplay-toggle]')) return;
    if (viewportRef.current?.contains(element)) userMove();
    else takeOver();
  };

  /** The engine, for a move that is not autoplay's. */
  const takeOver = () => {
    autoplayMovedRef.current = false;
    stepFromRef.current = null;
    return engineRef.current;
  };

  /** The engine, for the user's move: it also stops autoplay. */
  const userMove = () => {
    if (autoplaying) setPlaying(false);
    return takeOver();
  };

  useImperativeHandle(
    handleRef,
    () => ({
      scrollTo: (index) => takeOver()?.scrollTo(index),
      next: () => takeOver()?.next(),
      prev: () => takeOver()?.prev()
    }),
    []
  );

  // Only the first render is unmeasured, so the walk runs once, and on the
  // server.
  const slides = state.count === null ? slidesIn(children) : null;

  return (
    <DeckContext
      value={{
        ...state,
        slides,
        initialIndex,
        orientation,
        loop,
        viewportRef,
        engineRef,
        hasAutoplay: autoplaying,
        playing,
        togglePlaying,
        userMove
      }}
    >
      <div
        role="region"
        aria-roledescription="carousel"
        // Raw defaultIndex until measured: clamping needs the slide count.
        // Like each slide's data-current, the last settled position: it
        // trails a new `index` until the deck settles there.
        data-index={state.index}
        {...props}
        // Focus entering the deck stops autoplay until the toggle starts it
        // again (APG carousel); focus on the toggle itself does not.
        onFocus={(event) => {
          onFocus?.(event);
          if (
            autoplaying &&
            !(event.target as Element).closest(
              '[data-slidedeck-autoplay-toggle]'
            )
          ) {
            setPlaying(false);
          }
        }}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          if (autoplaying) setHovered(true);
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          if (autoplaying) setHovered(false);
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          userInput(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          userInput(event);
        }}
        onWheel={(event) => {
          onWheel?.(event);
          userInput(event);
        }}
      >
        {children}
        {/* Announces the slide the deck moves to, unless autoplay started
            the move; off while autoplay rotates the deck (APG carousel).
            Empty until the deck first moves, so hydration announces
            nothing. */}
        <div
          aria-live={rotating ? 'off' : 'polite'}
          aria-atomic="true"
          data-slidedeck-live=""
          style={visuallyHidden}
        >
          {announcement}
        </div>
      </div>
    </DeckContext>
  );
}

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0
};

/** The viewport's slides: its children but snap targets and loop copies. */
const slideCount = (viewport: HTMLElement) =>
  [...viewport.children].filter(
    (child) => !child.hasAttribute(SNAP_TARGET) && !child.hasAttribute(COPY)
  ).length;

/** The slides in the first Deck.Viewport among `children`, looking through
 * elements and fragments but not into components, which Root cannot render
 * ahead of time; null if none is found. Counted as Viewport counts them. */
function slidesIn(children: ReactNode): number | null {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (child.type === Viewport) {
      return Children.toArray(child.props.children).length;
    }
    if (typeof child.type !== 'string' && child.type !== Fragment) continue;
    const found = slidesIn(child.props.children);
    if (found !== null) return found;
  }
  return null;
}

/** Warns about controlled-deck mistakes, as React does for an input's
 * `value`: once per deck instance for each kind, so one warning never hides
 * another. */
function useDevWarnings(
  index: number | undefined,
  defaultIndex: number | undefined,
  onIndexChange: ((index: number) => void) | undefined
) {
  const controlled = index !== undefined;
  const [wasControlled] = useState(controlled);
  const both = controlled && defaultIndex !== undefined;
  const switched = controlled !== wasControlled;
  const readOnly = controlled && onIndexChange === undefined;
  const warned = useRef(new Set<string>());
  useEffect(() => {
    const warn = (kind: string, message: string) => {
      if (warned.current.has(kind)) return;
      warned.current.add(kind);
      console.error(message);
    };
    if (both) {
      warn(
        'both',
        'Deck.Root takes either index or defaultIndex, not both. Pass index ' +
          'with onIndexChange for a controlled deck, or defaultIndex for an ' +
          'uncontrolled one.'
      );
    }
    if (switched) {
      warn(
        'switched',
        `Deck.Root is changing ${
          wasControlled
            ? 'a controlled deck to be uncontrolled'
            : 'an uncontrolled deck to be controlled'
        }. A deck should not switch between the two: choose index or ` +
          'defaultIndex for its whole life.'
      );
    }
    if (readOnly) {
      warn(
        'readOnly',
        'Deck.Root was given index without onIndexChange, so a scroll will ' +
          'return the deck to index. Pass onIndexChange to follow the ' +
          'scroll, or defaultIndex for an uncontrolled deck.'
      );
    }
  }, [both, switched, readOnly, wasControlled]);
}

const SlideContext = createContext<{
  index: number;
  count: number;
  /** Whether an effect stacks the slides in one place. */
  stacked: boolean;
  /** The effect's inline styles for each slide. */
  style: CSSProperties | undefined;
  /** A loop's copy of the slide, and which side of the slides it is on. */
  copy?: 'before' | 'after';
} | null>(null);

/**
 * A transition built on progress while the viewport keeps scrolling natively
 * (CONTEXT.md), passed to `Deck.Viewport`'s `effect`. Each effect is its own
 * entry point, such as `@slidedeck/react/fade`, so a deck that imports none
 * ships none of their code.
 */
export interface Effect {
  /** Names the effect's stylesheet, so a page holds one copy of it. */
  name: string;
  /** The effect's appearance, read from `--deck-slide-progress` and the
   * slides' data attributes. Zero-specificity `:where()` rules, so consumer
   * CSS overrides any of them (ADR-0003). */
  css: string;
  /** The structural styles the effect needs, set inline as the deck's own
   * are, for a deck of `count` slides, a loop's copies included. With
   * `target`, the viewport holds an empty snap target per slide, and per
   * copy, in the order they run, after the slides, styled by it: the slides
   * stack in one place, the engine measures each by its target, and every
   * slide but the focal one is inert, as it cannot be seen. */
  layout?: (
    orientation: Orientation,
    count: number
  ) => {
    viewport?: CSSProperties;
    slide?: CSSProperties;
    target?: (index: number) => CSSProperties;
  };
}

export interface ViewportProps extends ComponentProps<'div'> {
  /** An effect, imported from its own entry point, such as `fade` from
   * `@slidedeck/react/fade`. */
  effect?: Effect;
}

const viewportStyles: Record<Orientation, CSSProperties> = {
  horizontal: {
    display: 'flex',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory'
  },
  vertical: {
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    scrollSnapType: 'y mandatory'
  }
};

/** The native scroll container. Its children are the deck's slides; with
 * `loop`, a copy of every slide on each side of them; an `effect` may add a
 * snap target after them for each. */
export function Viewport({ style, children, effect, ...props }: ViewportProps) {
  const { viewportRef, engineRef, orientation, loop, count } =
    useDeck('Viewport');
  const slides = Children.toArray(children);
  // A deck whose slides all fit has nothing to loop (see createDeck).
  const copies = loop && !everySlideFits(count);
  const run = slides.length * (copies ? 3 : 1);
  const layout = effect?.layout?.(orientation, run);
  const target = layout?.target;
  // Adding or removing a slide, or the copies, can change the snap points
  // without resizing the viewport, which is all the engine observes.
  useLayoutEffect(() => {
    engineRef.current?.refresh();
  }, [engineRef, slides.length, copies]);
  const set = (copy?: 'before' | 'after') =>
    slides.map((slide, index) => (
      // `toArray` gives every element a key derived from the consumer's,
      // so a reordered slide moves instead of remounting.
      <SlideContext
        key={isValidElement(slide) ? slide.key : index}
        value={{
          index,
          count: slides.length,
          stacked: target !== undefined,
          // The copies before the slides come after them in the document, so
          // a consumer's `:nth-child()` still counts the slides from 1.
          style:
            copy === 'before' ? { ...layout?.slide, order: -1 } : layout?.slide,
          copy
        }}
      >
        {slide}
      </SlideContext>
    ));
  return (
    <div
      ref={viewportRef}
      tabIndex={0}
      data-slidedeck-viewport=""
      data-orientation={orientation}
      data-slidedeck-effect={effect?.name}
      style={{
        ...viewportStyles[orientation],
        ...layout?.viewport,
        ...style
      }}
      {...props}
    >
      <style href="slidedeck-slide" precedence="slidedeck">
        {slideDefaults}
      </style>
      {effect && (
        <style href={`slidedeck-${effect.name}`} precedence="slidedeck">
          {effect.css}
        </style>
      )}
      {set()}
      {copies && <Fragment key="after">{set('after')}</Fragment>}
      {copies && <Fragment key="before">{set('before')}</Fragment>}
      {target &&
        Array.from({ length: run }, (_, index) => (
          <div
            key={`target-${index}`}
            aria-hidden="true"
            data-slidedeck-snap-target=""
            style={target(index)}
          />
        ))}
    </div>
  );
}

// A slide's size and alignment are geometry, which belongs to consumer CSS
// (ADR-0003). These defaults make a deck work with no stylesheet, and their
// zero specificity lets any consumer rule override them, which inline styles
// would not.
const slideDefaults =
  ':where([data-slidedeck-slide]){width:100%;scroll-snap-align:start}' +
  ':where([data-orientation=vertical]>[data-slidedeck-slide]){height:100%}';

// Not yet in React's CSSProperties.
const initialTarget = { scrollInitialTarget: 'nearest' } as CSSProperties;

/** One slide, labelled "n of m". Its size and alignment are consumer CSS.
 * For CSS to read, it carries `--deck-slide-index`, its index, from the first
 * render; once mounted, `--deck-slide-progress`, its signed distance from the
 * focal position in slides, and `data-in-view` while any of it is in view,
 * both kept up to date as the deck scrolls without a React render. Where an
 * effect stacks the slides, as fade does, every slide but the focal one is
 * inert. */
export function Slide({ style, ...props }: ComponentProps<'div'>) {
  const deck = useDeck('Slide');
  const slide = use(SlideContext);
  if (!slide) throw new Error('Deck.Slide must be inside Deck.Viewport');
  const { index, count, stacked, copy } = slide;
  const start = !copy && index === clampSlide(deck.initialIndex, count);
  // Until the viewport is measured, the slide it starts at.
  const current = !copy && (deck.slide === null ? start : index === deck.slide);
  const focal = !copy && (deck.focal === null ? start : index === deck.focal);
  // Stacked, only the focal slide can be seen, so only it can be reached. A
  // loop's copy can never be reached, nor announced.
  const inert = copy !== undefined || (stacked && !focal);
  const { viewportRef } = deck;
  // Focus in a slide that goes inert would drop to the body: it moves to the
  // viewport instead, where arrow keys still move the deck.
  useLayoutEffect(() => {
    if (!inert) return;
    const viewport = viewportRef.current;
    const focused = document.activeElement?.closest(
      '[data-slidedeck-slide][inert]'
    );
    if (viewport && focused?.parentElement === viewport) {
      viewport.focus({ preventScroll: true });
    }
  }, [inert, viewportRef]);
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}`}
      data-slidedeck-slide=""
      data-slidedeck-copy={copy}
      aria-hidden={copy ? true : undefined}
      data-current={current ? '' : undefined}
      data-focal={focal ? '' : undefined}
      inert={inert}
      style={{
        flexShrink: 0,
        // A slide's place in the deck, for CSS such as an entry stagger.
        // Static, so server HTML has it; the engine writes the values that
        // change as the deck scrolls (`--deck-slide-progress`,
        // `data-in-view`).
        ...({ '--deck-slide-index': index } as CSSProperties),
        // Server HTML paints at defaultIndex before any script runs, where
        // supported; elsewhere Root's layout effect scrolls before paint.
        // Exact with one slide per snap point; see createDeck's mount.
        ...(start && initialTarget),
        ...slide.style,
        ...style
      }}
      {...props}
    />
  );
}

/** One snap point, or none, means there is nowhere to go: Prev, Next, Dots
 * and Counter are then absent. The server cannot measure, so it renders Prev
 * and Next as if the slides overflow, the common case: a deck whose slides all
 * fit drops them at hydration, which shifts layout. */
const everySlideFits = (count: number | null) => count !== null && count <= 1;

interface StepButtonProps extends ComponentProps<'button'> {
  atEnd: boolean;
  step: () => void;
  label: string;
}

/** A consumer's `onClick` runs first and can cancel the step with
 * `preventDefault()`; a consumer's `disabled` can disable the button but not
 * enable it at its end. */
function StepButton({
  atEnd,
  step,
  label,
  onClick,
  disabled,
  children,
  ...props
}: StepButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={atEnd || disabled}
      data-disabled={atEnd || disabled ? '' : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) step();
      }}
    >
      {children ?? label}
    </button>
  );
}

/** Moves the deck one snap point back. Disabled at the first unless the deck
 * loops; absent when every slide fits. Marked `data-slidedeck-prev` for CSS
 * to select. */
export function Prev(props: ComponentProps<'button'>) {
  const { index, count, loop, userMove } = useDeck('Prev');
  if (everySlideFits(count)) return null;
  return (
    <StepButton
      {...props}
      data-slidedeck-prev=""
      atEnd={!loop && index === 0}
      step={() => userMove()?.prev()}
      label="Previous"
    />
  );
}

/** Moves the deck one snap point on. Disabled at the last unless the deck
 * loops; absent when every slide fits. Marked `data-slidedeck-next` for CSS
 * to select. */
export function Next(props: ComponentProps<'button'>) {
  const { index, count, loop, userMove } = useDeck('Next');
  if (everySlideFits(count)) return null;
  return (
    <StepButton
      {...props}
      data-slidedeck-next=""
      atEnd={!loop && count !== null && index >= count - 1}
      step={() => userMove()?.next()}
      label="Next"
    />
  );
}

/** The pages Dots and Counter show: the snap points, once measured. Before,
 * as on the server, a page per slide, the common case, so server HTML is exact
 * there; a deck whose snap points differ corrects at hydration (ADR-0003).
 * `count` is null only where Root cannot see Viewport's slides. */
function usePages(primitive: string) {
  const { index, count, slides, initialIndex, userMove } = useDeck(primitive);
  if (count !== null || slides === null) return { index, count, userMove };
  return { index: clampSlide(initialIndex, slides), count: slides, userMove };
}

/** A labelled group of buttons, one per page: one per snap point, so with
 * several slides in a page a dot stands for the page, not a slide (ADR-0004).
 * The current one carries `aria-current`; the group's data attributes are the
 * deck's state, which a consumer's cannot overwrite. Absent when every slide
 * fits. */
export function Dots(props: Omit<ComponentProps<'div'>, 'children'>) {
  const { index, count, userMove } = usePages('Dots');
  if (everySlideFits(count)) return null;
  return (
    <div
      role="group"
      aria-label="Choose page"
      {...props}
      data-slidedeck-dots=""
      data-index={count === null ? undefined : index}
      data-count={count ?? undefined}
    >
      {Array.from({ length: count ?? 0 }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Go to page ${i + 1}`}
          aria-current={i === index ? 'true' : undefined}
          data-index={i}
          onClick={() => userMove()?.scrollTo(i)}
        />
      ))}
    </div>
  );
}

/** The current page and the total, as "3 / 10": counts pages, as Dots do.
 * Absent when every slide fits. Not a live region: each slide is already
 * labelled "n of m". Its data attributes are the deck's state, which
 * a consumer's cannot overwrite. */
export function Counter(props: Omit<ComponentProps<'span'>, 'children'>) {
  const { index, count } = usePages('Counter');
  if (everySlideFits(count)) return null;
  const known = count !== null;
  return (
    <span
      {...props}
      data-slidedeck-counter=""
      data-index={known ? index : undefined}
      data-count={known ? count : undefined}
    >
      {known && `${index + 1} / ${count}`}
    </span>
  );
}

/**
 * Stops and starts `Deck.Root`'s `autoplay`, so motion can always be stopped
 * (WCAG 2.2.2). Its name is the action it takes, "Stop slide rotation" or
 * "Start slide rotation", rather than `aria-pressed` (APG carousel); it is
 * marked `data-playing` while autoplay is on, paused by a pointer or not.
 * Children replace the visible name: give both states, shown by
 * `data-playing` in CSS. Place it first among the deck's controls, ahead of
 * the slides, so keyboard users reach it before the moving content. Focus on
 * it does not stop autoplay, so it can be pressed. Starting autoplay where it
 * stopped at the last snap point rewinds to the first. A consumer's
 * `onClick` runs first and can cancel the toggle with `preventDefault()`.
 * Absent without `autoplay`, and when every slide fits.
 */
export function AutoplayToggle({
  onClick,
  children,
  ...props
}: ComponentProps<'button'>) {
  const { hasAutoplay, playing, togglePlaying, count } =
    useDeck('AutoplayToggle');
  if (!hasAutoplay || everySlideFits(count)) return null;
  return (
    <button
      type="button"
      {...props}
      data-slidedeck-autoplay-toggle=""
      data-playing={playing ? '' : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) togglePlaying();
      }}
    >
      {children ?? (playing ? 'Stop slide rotation' : 'Start slide rotation')}
    </button>
  );
}
