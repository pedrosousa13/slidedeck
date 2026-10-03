import {
  Children,
  createContext,
  isValidElement,
  use,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type RefObject
} from 'react';
import { createDeck, type DeckEngine } from '@slidedeck/core';

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

export interface RootProps extends ComponentProps<'div'> {
  /**
   * The slide to start at, clamped to the slides there are: the deck starts
   * at the snap point that slide rests at. With one slide per snap point,
   * that is the snap point at this index. Read once, on mount.
   */
  defaultIndex?: number;
  /** Called once each time the viewport settles on a new snap point. */
  onIndexChange?: (index: number) => void;
}

/** One deck: a labelled carousel region holding a viewport and its controls. */
export function Root({ defaultIndex = 0, onIndexChange, ...props }: RootProps) {
  const [initialIndex] = useState(defaultIndex);
  const [state, setState] = useState<{
    index: number;
    count: number | null;
    slide: number | null;
  }>({ index: initialIndex, count: null, slide: null });
  const viewportRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DeckEngine>(null);
  const onIndexChangeRef = useRef(onIndexChange);

  useLayoutEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) throw new Error('Deck.Root must contain a Deck.Viewport');
    // The first report is where the deck starts, not a change.
    let index: number | undefined;
    const engine = createDeck(viewport, {
      start: clampSlide(initialIndex, viewport.children.length),
      onChange(next) {
        setState(next);
        if (index !== undefined && next.index !== index) {
          onIndexChangeRef.current?.(next.index);
        }
        index = next.index;
      }
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [initialIndex]);

  return (
    <DeckContext value={{ ...state, initialIndex, viewportRef, engineRef }}>
      <div
        role="region"
        aria-roledescription="carousel"
        data-index={state.index}
        {...props}
      />
    </DeckContext>
  );
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
