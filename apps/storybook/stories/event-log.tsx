import { useEffect, useRef, useState } from 'react';
import type { Decorator } from '@storybook/react-vite';

/**
 * An on-screen event log for the loop stories (#82), to see on a phone what
 * happens at the end of each swipe (#48). Off unless the story's URL has
 * `log=1`, as in `iframe.html?id=deck--loop&viewMode=story&log=1`; off, it
 * renders the story alone, as if it were not there.
 *
 * It watches the deck from outside: window pointer events, the viewport's
 * scroll and `scrollend`, `onIndexChange`, and layout reads. Within a scroll
 * or pointer handler it reads only the scroll position. It measures snap
 * points the way the engine does (`snapRest` in packages/core/src/index.ts)
 * only at an end event and once the deck has been still 300ms: a readout of
 * its own, not the engine's 100ms quiet.
 */
export const eventLog: Decorator = (Story, context) => {
  if (!on) return <Story />;
  const onIndexChange = context.args.onIndexChange as
    ((index: number) => void) | undefined;
  return (
    <>
      <Story
        args={{
          ...context.args,
          onIndexChange: (index: number) => {
            write(`onIndexChange ${index}`);
            onIndexChange?.(index);
          }
        }}
      />
      <Panel />
    </>
  );
};

/** At most this many lines, newest first, under the feature line. */
const MAX_LINES = 40;
/** A scroll line at most this often, in ms. */
const SCROLL_LINE_MS = 100;
/** No scroll for this long, in ms, reads where the deck rests. */
const STILL_MS = 300;

const on = new URLSearchParams(window.location.search).get('log') === '1';

let lines: string[] = [];
let render = () => {};
/** The deck's scroll position along its axis, while a panel is mounted. */
let position: (() => number) | null = null;

// Pointer lines carry the scroll position as the press or release comes,
// before the engine hears it: registered as the stories load, so ahead of
// the engine's own window listeners, which run in the order they were added.
if (on) {
  for (const type of ['pointerdown', 'pointerup', 'pointercancel']) {
    addEventListener(
      type,
      (event) => {
        if (!position) return;
        const { pointerType } = event as PointerEvent;
        write(`${type} ${pointerType} at ${round(position())}`);
      },
      { capture: true, passive: true }
    );
  }
}

function write(text: string) {
  lines = [`${Math.round(performance.now())} ${text}`, ...lines].slice(
    0,
    MAX_LINES
  );
  render();
}

const features = () =>
  `onscrollend in window: ${'onscrollend' in window} | onscrollsnapchange in window: ${
    'onscrollsnapchange' in window
  } | devicePixelRatio: ${window.devicePixelRatio} | ${navigator.userAgent}`;

function Panel() {
  const out = useRef<HTMLPreElement>(null);
  const [status, setStatus] = useState('');
  // The whole log as of when it opened, in a scrollable text field to select
  // and copy by hand; null when closed.
  const [full, setFull] = useState<string | null>(null);

  useEffect(() => {
    const viewport = document.querySelector<HTMLElement>(
      '[data-slidedeck-viewport]'
    );
    if (!viewport) return;
    const head = features();
    render = () => {
      if (out.current) out.current.textContent = [head, ...lines].join('\n');
    };
    const axis = axisOf(viewport);
    position = axis.position;
    // Read at each rest, so a scroll handler reads no layout.
    let length = setLength(viewport, axis);
    write(`axis ${axis.name}, set length ${round(length)}`);

    let last = axis.position();
    let lineAt = -Infinity;
    let still = 0;
    const rest = (label: string) => {
      length = setLength(viewport, axis);
      write(`${label} ${restReadout(viewport, axis)}`);
    };
    const onScroll = () => {
      const at = axis.position();
      const moved = at - last;
      if (length > 0 && Math.abs(Math.abs(moved) - length) < length * 0.05) {
        write(`jump ${round(last)} → ${round(at)} (set ${round(length)})`);
      }
      last = at;
      const now = performance.now();
      if (now - lineAt >= SCROLL_LINE_MS) {
        lineAt = now;
        write(`scroll ${round(at)}`);
      }
      clearTimeout(still);
      still = window.setTimeout(() => rest(`still ${STILL_MS}ms`), STILL_MS);
    };
    // The engine settles a scroll it did not start at its end event:
    // `scrollsnapchange` where there is one, as in Chromium, or `scrollend`.
    // Captured on the way down, so the log reads the rest before the engine's
    // own listener settles the deck and jumps it off a copy. A move the
    // engine started settles as it arrives, in a scroll event, before either.
    const ends = ['scrollsnapchange', 'scrollend'] as const;
    const onEnd = (event: Event) => {
      if (event.target === viewport) rest(event.type);
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });
    for (const type of ends) {
      document.addEventListener(type, onEnd, { capture: true });
    }
    return () => {
      viewport.removeEventListener('scroll', onScroll);
      for (const type of ends) {
        document.removeEventListener(type, onEnd, { capture: true });
      }
      clearTimeout(still);
      lines = [];
      render = () => {};
      position = null;
    };
  }, []);

  const text = () => out.current?.textContent ?? '';
  const copied = (ok: boolean) => {
    setStatus(ok ? 'copied' : 'copy failed: select and copy below');
    if (!ok) setFull(text());
  };
  const copyAll = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text()).then(
        () => copied(true),
        () => copied(false)
      );
      return;
    }
    // Over plain http, as from a phone on the LAN, there is no clipboard API.
    // iOS selects a field's text only with setSelectionRange, and zooms to a
    // focused field under 16px.
    const area = document.createElement('textarea');
    area.value = text();
    area.readOnly = true;
    area.style.cssText = 'position:fixed;top:0;opacity:0;font-size:16px';
    document.body.append(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    const ok = document.execCommand('copy');
    area.remove();
    copied(ok);
  };
  const auto = { pointerEvents: 'auto' } as const;

  return (
    <section
      role="log"
      aria-label="Event log"
      dir="ltr"
      style={{
        position: 'fixed',
        insetInline: 0,
        bottom: 0,
        height: '33vh',
        overflow: 'hidden',
        pointerEvents: 'none',
        background: 'rgb(0 0 0 / 0.8)',
        color: '#fff',
        font: '10px/1.3 ui-monospace, Menlo, monospace',
        zIndex: 2147483647
      }}
    >
      <div style={{ display: 'flex', gap: 8, padding: 4 }}>
        <button
          type="button"
          style={auto}
          onClick={() => {
            lines = [];
            render();
          }}
        >
          Clear
        </button>
        <button type="button" style={auto} onClick={copyAll}>
          Copy all
        </button>
        <button
          type="button"
          style={auto}
          onClick={() => setFull(full === null ? text() : null)}
        >
          {full === null ? 'Expand' : 'Close'}
        </button>
        <span role="status">{status}</span>
      </div>
      <pre
        ref={out}
        hidden={full !== null}
        style={{ margin: 0, padding: 4, whiteSpace: 'pre-wrap' }}
      />
      {full !== null && (
        <textarea
          aria-label="Full event log"
          readOnly
          value={full}
          style={{
            ...auto,
            boxSizing: 'border-box',
            width: '100%',
            height: 'calc(100% - 2.5rem)',
            overflow: 'auto',
            font: '16px/1.3 ui-monospace, Menlo, monospace'
          }}
        />
      )}
    </section>
  );
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The deck's axis, as the engine's `axisOf` reads it. */
function axisOf(viewport: HTMLElement) {
  const vertical = viewport.dataset.orientation === 'vertical';
  const sign =
    !vertical && getComputedStyle(viewport).direction === 'rtl' ? -1 : 1;
  const span = (
    box: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>
  ): [number, number] =>
    vertical
      ? [box.top, box.bottom]
      : sign === 1
        ? [box.left, box.right]
        : [-box.right, -box.left];
  return {
    name: vertical ? 'y' : sign === 1 ? 'x' : 'x, right to left',
    position: () =>
      vertical ? viewport.scrollTop : sign * viewport.scrollLeft,
    span,
    view() {
      const box = viewport.getBoundingClientRect();
      const left = box.left + viewport.clientLeft;
      const top = box.top + viewport.clientTop;
      return span({
        left,
        right: left + viewport.clientWidth,
        top,
        bottom: top + viewport.clientHeight
      });
    },
    snapAlign(box: Element) {
      const values = getComputedStyle(box).scrollSnapAlign.split(' ');
      return (vertical ? values[0] : values.pop()) ?? 'none';
    },
    insets(
      style: CSSStyleDeclaration,
      property: 'scrollPadding' | 'scrollMargin',
      size: number
    ): [number, number] {
      const sides = vertical
        ? (['Top', 'Bottom'] as const)
        : sign === 1
          ? (['Left', 'Right'] as const)
          : (['Right', 'Left'] as const);
      const [start, end] = sides.map((side) => {
        const value = style[`${property}${side}`];
        const amount = parseFloat(value) || 0;
        return value.endsWith('%') ? (amount / 100) * size : amount;
      });
      return [start, end];
    }
  };
}

type Axis = ReturnType<typeof axisOf>;

/** The copies before, the slides and the copies after, as the engine's
 * `slidesOf` orders them; `first` is slide 0's place. */
function runOf(viewport: HTMLElement) {
  const slides: Element[] = [];
  const before: Element[] = [];
  const after: Element[] = [];
  for (const child of viewport.children) {
    const copy = child.getAttribute('data-slidedeck-copy');
    if (copy === null) slides.push(child);
    else (copy === 'before' ? before : after).push(child);
  }
  return {
    run: [...before, ...slides, ...after],
    first: before.length,
    count: slides.length
  };
}

/** From slide 0 to its copy after the slides, as the engine measures a set;
 * 0 without copies. */
function setLength(viewport: HTMLElement, axis: Axis) {
  const { run, first, count } = runOf(viewport);
  if (first === 0 || run.length <= first + count) return 0;
  return (
    axis.span(run[first + count].getBoundingClientRect())[0] -
    axis.span(run[first].getBoundingClientRect())[0]
  );
}

/**
 * Where the deck rests against the snap points, as the engine's settle reads
 * it: each slide's and copy's rest is `snapRest`'s, rounded and unclamped, and
 * the deck is on one within 1px. On a copy and on no slide is where the
 * engine jumps a set back.
 */
function restReadout(viewport: HTMLElement, axis: Axis) {
  const at = axis.position();
  const view = axis.view();
  const [padStart, padEnd] = axis.insets(
    getComputedStyle(viewport),
    'scrollPadding',
    view[1] - view[0]
  );
  const snapport: [number, number] = [view[0] + padStart, view[1] - padEnd];
  const { run, first, count } = runOf(viewport);
  const rests = run.map((box, i) => {
    const align = axis.snapAlign(box);
    if (align === 'none') return null;
    const [start, end] = axis.span(box.getBoundingClientRect());
    const [marginStart, marginEnd] = axis.insets(
      getComputedStyle(box),
      'scrollMargin',
      0
    );
    const [s, e] = [start - marginStart, end + marginEnd];
    const offset =
      align === 'center'
        ? (s + e) / 2 - (snapport[0] + snapport[1]) / 2
        : align === 'end'
          ? e - snapport[1]
          : s - snapport[0];
    const own = i >= first && i < first + count;
    const slide = (((i - first) % count) + count) % count;
    return {
      rest: Math.round(at + offset),
      name: own
        ? `slide ${slide + 1}`
        : `copy ${i < first ? 'before' : 'after'} of slide ${slide + 1}`,
      own
    };
  });
  const snapping = rests.filter((r) => r !== null);
  if (snapping.length === 0) return `${round(at)} no snap points`;
  const near = (r: { rest: number }) => Math.abs(r.rest - at) <= 1;
  const nearest = snapping.reduce((a, b) =>
    Math.abs(b.rest - at) < Math.abs(a.rest - at) ? b : a
  );
  const where = snapping.some((r) => r.own && near(r))
    ? 'on a slide'
    : snapping.some(near)
      ? 'on a copy, no slide within 1px: the engine jumps'
      : 'off every snap point by more than 1px';
  return `${round(at)} nearest ${nearest.name} rest ${nearest.rest} Δ${round(
    at - nearest.rest
  )}: ${where}`;
}
