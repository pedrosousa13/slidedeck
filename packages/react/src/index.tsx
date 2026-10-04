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
import { createDeck, type DeckEngine, type Orientation } from '@slidedeck/core';

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
  viewportRef: RefObject<HTMLDivElement | null>;
  engineRef: RefObject<DeckEngine | null>;
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

/** One deck: a labelled carousel region holding a viewport and its controls. */
export function Root({
  index,
  defaultIndex,
  onIndexChange,
  handleRef,
  drag = true,
  onFocalChange,
  clickToFocus = false,
  orientation = 'horizontal',
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
  useLayoutEffect(() => {
    const engine = engineRef.current;
    if (index !== undefined && state.count !== null && engine) {
      const heading = engine.target() ?? state.index;
      if (clampSlide(index, state.count) !== heading) engine.scrollTo(index);
    }
  }, [index, state.index, state.count]);

  useImperativeHandle(
    handleRef,
    () => ({
      scrollTo: (index) => engineRef.current?.scrollTo(index),
      next: () => engineRef.current?.next(),
      prev: () => engineRef.current?.prev()
    }),
    []
  );

  // Only the first render is unmeasured, so the walk runs once, and on the
  // server.
  const slides = state.count === null ? slidesIn(props.children) : null;

  return (
    <DeckContext
      value={{
        ...state,
        slides,
        initialIndex,
        orientation,
        viewportRef,
        engineRef
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
      />
    </DeckContext>
  );
}

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
  /** The effect's appearance, read from `--deck-progress` and the slides'
   * data attributes. Zero-specificity `:where()` rules, so consumer CSS
   * overrides any of them (ADR-0003). */
  css: string;
  /** The structural styles the effect needs, set inline as the deck's own
   * are, for a deck of `count` slides. With `target`, the viewport holds an
   * empty snap target per slide after the slides, styled by it: the slides
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

/** The native scroll container. Its children are the deck's slides; an
 * `effect` may add a snap target after them for each. */
export function Viewport({ style, children, effect, ...props }: ViewportProps) {
  const { viewportRef, engineRef, orientation } = useDeck('Viewport');
  const slides = Children.toArray(children);
  const layout = effect?.layout?.(orientation, slides.length);
  const target = layout?.target;
  // Adding or removing a slide can change the snap points without resizing
  // the viewport, which is all the engine observes.
  useLayoutEffect(() => {
    engineRef.current?.refresh();
  }, [engineRef, slides.length]);
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
      {slides.map((slide, index) => (
        // `toArray` gives every element a key derived from the consumer's,
        // so a reordered slide moves instead of remounting.
        <SlideContext
          key={isValidElement(slide) ? slide.key : index}
          value={{
            index,
            count: slides.length,
            stacked: target !== undefined,
            style: layout?.slide
          }}
        >
          {slide}
        </SlideContext>
      ))}
      {target &&
        slides.map((_, index) => (
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
 * For CSS to read, it carries `--deck-index`, its index, from the first
 * render; once mounted, `--deck-progress`, its signed distance from the focal
 * position in slides, and `data-in-view` while any of it is in view, both
 * kept up to date as the deck scrolls without a React render. Where an effect
 * stacks the slides, as fade does, every slide but the focal one is inert. */
export function Slide({ style, ...props }: ComponentProps<'div'>) {
  const deck = useDeck('Slide');
  const slide = use(SlideContext);
  if (!slide) throw new Error('Deck.Slide must be inside Deck.Viewport');
  const { index, count, stacked } = slide;
  const start = index === clampSlide(deck.initialIndex, count);
  // Until the viewport is measured, the slide it starts at.
  const current = deck.slide === null ? start : index === deck.slide;
  const focal = deck.focal === null ? start : index === deck.focal;
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}`}
      data-slidedeck-slide=""
      data-current={current ? '' : undefined}
      data-focal={focal ? '' : undefined}
      // Stacked, only the focal slide can be seen, so only it can be reached.
      inert={stacked && !focal}
      style={{
        flexShrink: 0,
        // A slide's place in the deck, for CSS such as an entry stagger.
        // Static, so server HTML has it; the engine writes the values that
        // change as the deck scrolls (`--deck-progress`, `data-in-view`).
        ...({ '--deck-index': index } as CSSProperties),
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

/** Moves the deck one snap point back. Disabled at the first; absent when
 * every slide fits. */
export function Prev(props: ComponentProps<'button'>) {
  const { index, count, engineRef } = useDeck('Prev');
  if (everySlideFits(count)) return null;
  return (
    <StepButton
      {...props}
      atEnd={index === 0}
      step={() => engineRef.current?.prev()}
      label="Previous"
    />
  );
}

/** Moves the deck one snap point on. Disabled at the last; absent when
 * every slide fits. */
export function Next(props: ComponentProps<'button'>) {
  const { index, count, engineRef } = useDeck('Next');
  if (everySlideFits(count)) return null;
  return (
    <StepButton
      {...props}
      atEnd={count !== null && index >= count - 1}
      step={() => engineRef.current?.next()}
      label="Next"
    />
  );
}

/** The pages Dots and Counter show: the snap points, once measured. Before,
 * as on the server, a page per slide, the common case, so server HTML is exact
 * there; a deck whose snap points differ corrects at hydration (ADR-0003).
 * `count` is null only where Root cannot see Viewport's slides. */
function usePages(primitive: string) {
  const { index, count, slides, initialIndex, engineRef } = useDeck(primitive);
  if (count !== null || slides === null) return { index, count, engineRef };
  return { index: clampSlide(initialIndex, slides), count: slides, engineRef };
}

/** A labelled group of buttons, one per page: one per snap point, so with
 * several slides in a page a dot stands for the page, not a slide (ADR-0004).
 * The current one carries `aria-current`; the group's data attributes are the
 * deck's state, which a consumer's cannot overwrite. Absent when every slide
 * fits. */
export function Dots(props: Omit<ComponentProps<'div'>, 'children'>) {
  const { index, count, engineRef } = usePages('Dots');
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
          onClick={() => engineRef.current?.scrollTo(i)}
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
