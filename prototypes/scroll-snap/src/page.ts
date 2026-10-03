// THROWAWAY (#3). The chrome every technique page shares: banner, nav,
// toggles (as URL query parameters, so a configuration is a link), Prev and
// Next, and a HUD with a live jump detector the measurement suite and a
// person on a phone both read.

import './style.css';
import {
  createDeck,
  logicalPosition,
  nearestSlide,
  snapPoints,
  type Deck,
  type DeckOptions
} from './deck';
import { installDrag, type Drag, type Handoff } from './drag';
import { onSettle, settleSource } from './settle';

const params = new URLSearchParams(location.search);

export interface Control {
  key: string;
  label: string;
  /** Allowed values; the first is the default. Two values `['0','1']` is a checkbox. */
  values: readonly string[];
  disabled?: string;
}

export const commonControls: Control[] = [
  { key: 'group', label: 'Group snapping (3 per page)', values: ['0', '1'] },
  { key: 'vertical', label: 'Vertical', values: ['0', '1'] },
  { key: 'rtl', label: 'RTL', values: ['0', '1'] },
  { key: 'drag', label: 'Mouse drag', values: ['1', '0'] },
  { key: 'handoff', label: 'Drag handoff', values: ['scripted', 'restore'] }
];

export function param(control: Control): string {
  const value = params.get(control.key);
  return value !== null && control.values.includes(value)
    ? value
    : control.values[0];
}

export interface Technique {
  /** Visual position in slide units, for the jump detector. */
  logical(): number;
  /** Real index of the slide at the start edge. */
  focal(): number;
  /** Called at every settle not swallowed by a drag. */
  settle(): void;
  /** Called on every pointer move of a mouse drag. */
  dragMove?(): void;
  /** Called on every scroll event while no drag is running. */
  scroll?(): void;
  /** Extra HUD lines. */
  status?(): string;
  /** Whether hitting the physical scroll edge mid-motion counts as a fault. */
  loops: boolean;
}

export interface PageSpec {
  title: string;
  note: string;
  controls: Control[];
  build(
    deck: Deck,
    value: (key: string) => string,
    metrics: Metrics
  ): Technique;
}

export interface Metrics {
  frames: number;
  /** Largest visual movement between two frames, in slides. */
  maxStep: number;
  /** Largest change of that movement between frames, in slides. */
  maxAccel: number;
  /** Frames spent at the physical scroll edge while moving (loops only). */
  edgeHits: number;
  /** Signed visual distance moved, in slides. */
  travel: number;
  settles: number;
  /** Clone jumps or rotations the technique performed. */
  corrections: number;
  /** Times focus fell to <body> because the technique moved a node. */
  focusLost: number;
}

export interface Probe {
  m: Metrics;
  reset(): void;
  logical(): number;
  focal(): number;
  pos(): number;
  max(): number;
  /** Pixels between the scroll position and the nearest snap point. */
  snapError(): number;
  /** Milliseconds since the last scroll event. */
  idleFor(): number;
  pageExtent(): number;
  by(px: number): void;
  n: number;
  pageSize: number;
  settleSource: string;
  lastRelease(): Drag['lastRelease'] | undefined;
}

declare global {
  interface Window {
    __probe: Probe;
  }
}

export function setupPage(spec: PageSpec): void {
  document.title = `${spec.title} | scroll-snap prototype (THROWAWAY)`;
  // A page control with a common key replaces the common one.
  const controls = [
    ...commonControls.map(
      (c) => spec.controls.find((s) => s.key === c.key) ?? c
    ),
    ...spec.controls.filter((s) => !commonControls.some((c) => c.key === s.key))
  ];
  const value = (key: string) => {
    const control = controls.find((c) => c.key === key);
    if (!control) throw new Error(`unknown control ${key}`);
    return control.disabled ? control.values[0] : param(control);
  };

  document.body.innerHTML = `
    <div class="banner">THROWAWAY prototype for issue #3 (ADR-0001 engine gate). Not package code.</div>
    <nav>
      <a href="./index.html">Index</a>
      <a href="./loop-clone-jump.html">Loop: clone and jump</a>
      <a href="./loop-reposition.html">Loop: reposition</a>
      <a href="./drag.html">Drag</a>
      <a href="./fade.html">Fade</a>
    </nav>
    <h1></h1>
    <p class="note"></p>
    <form class="controls" id="controls"></form>
    <div id="stage"></div>
    <div class="buttons">
      <button type="button" id="prev">Prev</button>
      <button type="button" id="next">Next</button>
      <button type="button" id="reset">Reset metrics</button>
    </div>
    <div class="hud" id="hud" aria-live="off"></div>`;
  document.querySelector('h1')!.textContent = spec.title;
  document.querySelector('.note')!.textContent = spec.note;

  const form = document.querySelector<HTMLFormElement>('#controls')!;
  for (const control of controls) {
    const label = document.createElement('label');
    const current = value(control.key);
    if (control.values.length === 2 && control.values.includes('1')) {
      label.innerHTML = `<input type="checkbox" name="${control.key}"> ${control.label}`;
      label.querySelector('input')!.checked = current === '1';
    } else {
      label.innerHTML = `${control.label} <select name="${control.key}">${control.values
        .map((v) => `<option>${v}</option>`)
        .join('')}</select>`;
      label.querySelector('select')!.value = current;
    }
    if (control.disabled) {
      label.setAttribute('aria-disabled', 'true');
      label.title = control.disabled;
      label.querySelector<HTMLInputElement>('input, select')!.disabled = true;
    }
    form.append(label);
  }
  form.addEventListener('change', () => {
    const next = new URLSearchParams();
    for (const control of controls) {
      const field = form.elements.namedItem(control.key) as
        HTMLInputElement | HTMLSelectElement;
      const v =
        field instanceof HTMLInputElement && field.type === 'checkbox'
          ? field.checked
            ? '1'
            : '0'
          : field.value;
      if (v !== control.values[0]) next.set(control.key, v);
    }
    location.search = next.toString();
  });

  const opts: DeckOptions = {
    group: value('group') === '1',
    vertical: value('vertical') === '1',
    rtl: value('rtl') === '1'
  };
  const deck = createDeck(document.querySelector('#stage')!, opts);
  const m: Metrics = {
    frames: 0,
    maxStep: 0,
    maxAccel: 0,
    edgeHits: 0,
    travel: 0,
    settles: 0,
    corrections: 0,
    focusLost: 0
  };
  const technique = spec.build(deck, value, m);

  let drag: Drag | undefined;
  const emit = () => {
    m.settles++;
    technique.settle();
  };
  if (value('drag') === '1') {
    drag = installDrag(deck, value('handoff') as Handoff, {
      onMove: technique.dragMove,
      onEnd: emit
    });
  }
  onSettle(deck.vp, () => {
    if (drag?.handleSettle()) return;
    emit();
  });

  // Jump detector: sample the visual position every frame while scrolling.
  const { axis } = deck;
  const wrap = (d: number) => {
    const half = deck.n / 2;
    return ((((d + half) % deck.n) + deck.n) % deck.n) - half;
  };
  let last = technique.logical();
  let lastStep = 0;
  let lastScroll = -Infinity;
  let raf = 0;
  const frame = () => {
    const now = technique.logical();
    const step = wrap(now - last);
    m.frames++;
    m.travel += step;
    m.maxStep = Math.max(m.maxStep, Math.abs(step));
    m.maxAccel = Math.max(m.maxAccel, Math.abs(step - lastStep));
    lastStep = step;
    last = now;
    if (technique.loops) {
      const p = axis.pos;
      if (p <= 0.5 || p >= axis.max - 0.5) m.edgeHits++;
    }
    if (performance.now() - lastScroll < 250) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = 0;
      lastStep = 0;
    }
  };
  deck.vp.addEventListener(
    'scroll',
    () => {
      lastScroll = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
      if (!drag?.busy()) technique.scroll?.();
    },
    { passive: true }
  );

  const pageExtent = () =>
    deck.pageSize * axis.size(deck.track.querySelector('.slide')!);
  const reset = () => {
    Object.assign(m, {
      frames: 0,
      maxStep: 0,
      maxAccel: 0,
      edgeHits: 0,
      travel: 0,
      settles: 0,
      corrections: 0,
      focusLost: 0
    });
    last = technique.logical();
    lastStep = 0;
  };
  window.__probe = {
    m,
    reset,
    logical: technique.logical,
    focal: technique.focal,
    pos: () => axis.pos,
    max: () => axis.max,
    snapError: () =>
      Math.min(...snapPoints(deck).map((p) => Math.abs(p - axis.pos))),
    idleFor: () => performance.now() - lastScroll,
    pageExtent,
    by: (px) => axis.smoothBy(px),
    n: deck.n,
    pageSize: deck.pageSize,
    settleSource,
    lastRelease: () => drag?.lastRelease
  };

  document
    .querySelector('#prev')!
    .addEventListener('click', () => axis.smoothBy(-pageExtent()));
  document
    .querySelector('#next')!
    .addEventListener('click', () => axis.smoothBy(pageExtent()));
  document.querySelector('#reset')!.addEventListener('click', reset);

  const hud = document.querySelector<HTMLElement>('#hud')!;
  const features = [
    `settle via ${settleSource}`,
    `moveBefore ${'moveBefore' in Element.prototype ? 'yes' : 'no'}`,
    `scroll-driven animations ${CSS.supports('animation-timeline: scroll()') ? 'yes' : 'no'}`
  ].join(' · ');
  const suspect = () => m.maxAccel > 0.25 || m.edgeHits > 0;
  setInterval(() => {
    const release = drag?.lastRelease;
    hud.classList.toggle('warn', suspect());
    hud.textContent = [
      `slide ${technique.focal() + 1} / ${deck.n} · logical ${technique.logical().toFixed(2)}`,
      `settles ${m.settles} · corrections ${m.corrections} · focus lost ${m.focusLost}`,
      `max step ${m.maxStep.toFixed(2)} · max accel ${m.maxAccel.toFixed(2)} · edge hits ${m.edgeHits}${suspect() ? '  << POSSIBLE JUMP' : ''}`,
      release
        ? `last drag release ${release.velocity.toFixed(2)} px/ms → ${release.target ?? 'browser snap'}`
        : 'no drag yet',
      technique.status?.() ?? '',
      features
    ]
      .filter(Boolean)
      .join('\n');
  }, 200);
}

/** Shared helpers for techniques built on plain slides. */
export const focalIndex = (deck: Deck) =>
  Number(nearestSlide(deck).dataset.index);
export const logicalOf = (deck: Deck) => logicalPosition(deck);
