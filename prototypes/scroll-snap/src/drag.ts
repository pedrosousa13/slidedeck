// THROWAWAY (#3). Mouse drag on a native scroll-snap viewport.
//
// While the mouse is down, snapping is switched off and the pointer moves
// the scroll position directly. On release there are two handoffs to try:
//
// - `scripted`: project the release velocity to a snap point, smooth-scroll
//   there with snapping still off, and switch snapping back on at the
//   settle (by then the viewport already rests on a snap point).
// - `restore`: switch snapping back on at once and let the browser pick
//   and animate to a snap point itself. Velocity is ignored.
//
// Touch and pen are left to the browser: only `pointerType === 'mouse'`.

import { snapPoints, type Deck } from './deck';

export type Handoff = 'scripted' | 'restore';

export interface Drag {
  /** True while dragging or running the scripted release animation. */
  busy(): boolean;
  /** Call from the settle listener; true means "swallow this settle". */
  handleSettle(): boolean;
  lastRelease: { velocity: number; target: number | null } | null;
}

/** Below this release speed (px/ms) a drag is a placement, not a flick. */
const FLICK = 0.4;
/** How far a flick carries, in ms of release velocity. */
const MOMENTUM_MS = 220;

export function installDrag(
  deck: Deck,
  handoff: Handoff,
  hooks: { onMove?: () => void; onEnd: () => void }
): Drag {
  const { vp, axis } = deck;
  let phase: 'idle' | 'pending' | 'dragging' | 'animating' = 'idle';
  let pointer = -1;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let travel = 0;
  let samples: { t: number; travel: number }[] = [];

  vp.dataset.drag = handoff;

  const snapOff = () => {
    vp.style.scrollSnapType = 'none';
  };
  const snapOn = () => {
    vp.style.scrollSnapType = '';
  };

  const drag: Drag = {
    busy: () => phase === 'dragging' || phase === 'animating',
    handleSettle() {
      if (phase === 'dragging') return true;
      if (phase === 'animating') {
        snapOn();
        phase = 'idle';
      }
      return false;
    },
    lastRelease: null
  };

  vp.addEventListener('dragstart', (e) => e.preventDefault());

  vp.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (phase === 'animating') {
      // Grab the deck mid-animation: stop where it is.
      const here = axis.pos;
      axis.pos = here;
    }
    phase = 'pending';
    pointer = e.pointerId;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    travel = 0;
    samples = [{ t: e.timeStamp, travel: 0 }];
  });

  vp.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer) return;
    if (phase === 'pending') {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < 5) return;
      phase = 'dragging';
      vp.setPointerCapture(pointer);
      vp.classList.add('dragging');
      snapOff();
    }
    if (phase !== 'dragging') return;
    const delta = axis.dragDelta(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
    axis.pos = axis.pos + delta;
    travel += delta;
    samples.push({ t: e.timeStamp, travel });
    if (samples.length > 8) samples.shift();
    hooks.onMove?.();
  });

  const release = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = -1;
    if (phase === 'pending') {
      phase = 'idle';
      return;
    }
    if (phase !== 'dragging') return;
    vp.classList.remove('dragging');
    suppressNextClick();

    const velocity = releaseVelocity(samples, e.timeStamp);
    if (handoff === 'restore') {
      drag.lastRelease = { velocity, target: null };
      phase = 'idle';
      snapOn();
      return;
    }

    const pos = axis.pos;
    const points = snapPoints(deck);
    let target = nearest(points, pos + velocity * MOMENTUM_MS);
    if (Math.abs(velocity) > FLICK && (target - pos) * velocity <= 0) {
      // A flick always moves at least one snap point the way it was thrown.
      const ahead = points.filter((p) => (p - pos) * velocity > 0);
      if (ahead.length > 0) target = velocity > 0 ? ahead[0] : ahead.at(-1)!;
    }
    drag.lastRelease = { velocity, target };
    if (Math.abs(target - pos) < 1) {
      phase = 'idle';
      snapOn();
      hooks.onEnd();
      return;
    }
    phase = 'animating';
    axis.smoothTo(target);
  };
  vp.addEventListener('pointerup', release);
  vp.addEventListener('pointercancel', release);

  function suppressNextClick() {
    const swallow = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    vp.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => vp.removeEventListener('click', swallow, true), 0);
  }

  return drag;
}

function releaseVelocity(
  samples: { t: number; travel: number }[],
  now: number
): number {
  const last = samples.at(-1)!;
  // Held still before letting go: no flick.
  if (now - last.t > 60) return 0;
  const first = samples.find((s) => last.t - s.t <= 80) ?? samples[0];
  const dt = last.t - first.t;
  return dt > 0 ? (last.travel - first.travel) / dt : 0;
}

function nearest(points: number[], value: number): number {
  let best = points[0];
  for (const p of points) {
    if (Math.abs(p - value) < Math.abs(best - value)) best = p;
  }
  return best;
}
