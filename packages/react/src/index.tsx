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
  initialIndex: number;
  viewportRef: RefObject<HTMLDivElement | null>;
  engineRef: RefObject<DeckEngine | null>;
}

const DeckContext = createContext<DeckContextValue | null>(null);

function useDeck(primitive: string): DeckContextValue {
  const deck = use(DeckContext);
  if (!deck) throw new Error(`Deck.${primitive} must be inside Deck.Root`);
  return deck;
}

export interface RootProps extends ComponentProps<'div'> {
  /** The snap point to start at. Read once, on mount. */
  defaultIndex?: number;
  /** Called once each time the viewport settles on a new snap point. */
  onIndexChange?: (index: number) => void;
}

/** One deck: a labelled carousel region holding a viewport and its controls. */
export function Root({ defaultIndex = 0, onIndexChange, ...props }: RootProps) {
  const [initialIndex] = useState(defaultIndex);
  const [state, setState] = useState<{ index: number; count: number | null }>({
    index: initialIndex,
    count: null
  });
  const viewportRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<DeckEngine>(null);
  const onIndexChangeRef = useRef(onIndexChange);

  useLayoutEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) throw new Error('Deck.Root must contain a Deck.Viewport');
    let index = initialIndex;
    const engine = createDeck(viewport, {
      index,
      onChange(next) {
        setState(next);
        if (next.index === index) return;
        index = next.index;
        onIndexChangeRef.current?.(index);
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
  const { viewportRef } = useDeck('Viewport');
  const slides = Children.toArray(children);
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
  const { initialIndex } = useDeck('Slide');
  const slide = use(SlideContext);
  if (!slide) throw new Error('Deck.Slide must be inside Deck.Viewport');
  const { index, count } = slide;
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}`}
      data-slidedeck-slide=""
      style={{
        flexShrink: 0,
        // Server HTML paints at defaultIndex before any script runs, where
        // supported; elsewhere Root's layout effect scrolls before paint.
        ...(index === initialIndex && initialTarget),
        ...style
      }}
      {...props}
    />
  );
}

/** One snap point means there is nowhere to step to. */
const everySlideFits = (count: number | null) => count === 1;

/** Moves the deck one snap point back. Disabled at the first; absent when
 * every slide fits. */
export function Prev(props: ComponentProps<'button'>) {
  const { index, count, engineRef } = useDeck('Prev');
  if (everySlideFits(count)) return null;
  return (
    <button
      type="button"
      disabled={index === 0}
      onClick={() => engineRef.current?.prev()}
      {...props}
    >
      {props.children ?? 'Previous'}
    </button>
  );
}

/** Moves the deck one snap point on. Disabled at the last; absent when
 * every slide fits. */
export function Next(props: ComponentProps<'button'>) {
  const { index, count, engineRef } = useDeck('Next');
  if (everySlideFits(count)) return null;
  return (
    <button
      type="button"
      disabled={count !== null && index >= count - 1}
      onClick={() => engineRef.current?.next()}
      {...props}
    >
      {props.children ?? 'Next'}
    </button>
  );
}
