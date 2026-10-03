import {
  Children,
  createContext,
  isValidElement,
  use,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type Ref,
  type RefObject
} from 'react';
import { createDeck, type DeckEngine } from '@slidedeck/core';

// Left in the build for the consumer's bundler to replace, as React's own
// development checks are, so production bundles drop the warnings.
declare const process: { env: { NODE_ENV?: string } };

interface DeckContextValue {
  index: number;
  /** Snap point count; null until the viewport has been measured. */
  count: number | null;
  /** The current slide; null until the viewport has been measured. */
  slide: number | null;
  initialIndex: number;
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
  ...props
}: RootProps) {
  const [initialIndex] = useState(index ?? defaultIndex ?? 0);
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- the condition is constant for a build
    useDevWarnings(index, defaultIndex, onIndexChange);
  }
  const [state, setState] = useState<{
    index: number;
    count: number | null;
    slide: number | null;
  }>({ index: initialIndex, count: null, slide: null });
  const viewportRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DeckEngine>(null);
  const onIndexChangeRef = useRef(onIndexChange);
  const indexRef = useRef(index);

  useLayoutEffect(() => {
    onIndexChangeRef.current = onIndexChange;
    indexRef.current = index;
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) throw new Error('Deck.Root must contain a Deck.Viewport');
    // The first report is where the deck starts, not a change.
    let settled: number | undefined;
    const engine = createDeck(viewport, {
      index: initialIndex,
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
      }
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [initialIndex]);

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

  return (
    <DeckContext value={{ ...state, initialIndex, viewportRef, engineRef }}>
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

const SlideContext = createContext<{ index: number; count: number } | null>(
  null
);

const viewportStyle: CSSProperties = {
  display: 'flex',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory'
};

/** The native scroll container. Its children are the deck's slides. */
export function Viewport({ style, children, ...props }: ComponentProps<'div'>) {
  const { viewportRef, engineRef } = useDeck('Viewport');
  const slides = Children.toArray(children);
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
      style={{ ...viewportStyle, ...style }}
      {...props}
    >
      <style href="slidedeck-slide" precedence="slidedeck">
        {slideDefaults}
      </style>
      {slides.map((slide, index) => (
        // `toArray` gives every element a key derived from the consumer's,
        // so a reordered slide moves instead of remounting.
        <SlideContext
          key={isValidElement(slide) ? slide.key : index}
          value={{ index, count: slides.length }}
        >
          {slide}
        </SlideContext>
      ))}
    </div>
  );
}

// A slide's size and alignment are geometry, which belongs to consumer CSS
// (ADR-0003). These defaults make a deck work with no stylesheet, and their
// zero specificity lets any consumer rule override them, which inline styles
// would not.
const slideDefaults =
  ':where([data-slidedeck-slide]){width:100%;scroll-snap-align:start}';

// Not yet in React's CSSProperties.
const initialTarget = { scrollInitialTarget: 'nearest' } as CSSProperties;

/** One slide, labelled "n of m". Its size and alignment are consumer CSS. */
export function Slide({ style, ...props }: ComponentProps<'div'>) {
  const deck = useDeck('Slide');
  const slide = use(SlideContext);
  if (!slide) throw new Error('Deck.Slide must be inside Deck.Viewport');
  const { index, count } = slide;
  const start = index === clampSlide(deck.initialIndex, count);
  // Until the viewport is measured, the slide it starts at.
  const current = deck.slide === null ? start : index === deck.slide;
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}`}
      data-slidedeck-slide=""
      data-current={current ? '' : undefined}
      style={{
        flexShrink: 0,
        // Server HTML paints at defaultIndex before any script runs, where
        // supported; elsewhere Root's layout effect scrolls before paint.
        // Exact with one slide per snap point; see createDeck's mount.
        ...(start && initialTarget),
        ...style
      }}
      {...props}
    />
  );
}

/** One snap point means there is nowhere to step to. The server cannot
 * measure, so it renders Prev and Next as if the slides overflow, the common
 * case: a deck whose slides all fit drops them at hydration, which shifts
 * layout. */
const everySlideFits = (count: number | null) => count === 1;

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

/** A labelled group of buttons, one per page: one per snap point, so with
 * several slides in a page a dot stands for the page, not a slide (ADR-0004).
 * The current one carries `aria-current`. Empty until the viewport is
 * measured, as the server cannot count snap points; absent when every slide
 * fits. */
export function Dots(props: ComponentProps<'div'>) {
  const { index, count, engineRef } = useDeck('Dots');
  if (everySlideFits(count)) return null;
  return (
    <div role="group" aria-label="Choose page" {...props}>
      {Array.from({ length: count ?? 0 }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Go to page ${i + 1}`}
          aria-current={i === index ? 'true' : undefined}
          data-index={i}
          data-current={i === index ? '' : undefined}
          onClick={() => engineRef.current?.scrollTo(i)}
        />
      ))}
    </div>
  );
}
