// THROWAWAY (#3). Fade that keeps native scrolling.
//
// Empty snap targets, one per slide, give the viewport its scroll length
// and snap points. The slides are stacked with `position: sticky` in a grid
// area spanning the whole track, so they never leave the viewport; each slide's
// opacity follows scroll progress: 1 - |progress - index|.
//
// `js` sets opacity from a scroll listener. `css` uses a view timeline per
// snap target (scroll-driven animations) where the browser has them.
// `inert` makes every slide but the focal one inert; `none` leaves the
// invisible slides focusable, to see where focus lands.

import { makeSlide, type Deck } from '../deck';
import { setupPage } from '../page';

const cssTimelines = CSS.supports('animation-timeline: view()');

setupPage({
  title: 'Fade',
  note: 'Scroll or drag as usual: the viewport scrolls natively, but the slides stay put and cross-fade.',
  controls: [
    {
      key: 'group',
      label: 'Group snapping',
      values: ['0', '1'],
      disabled: 'Not meaningful for a fade: one slide is shown at a time.'
    },
    { key: 'driver', label: 'Opacity from', values: ['js', 'css'] },
    {
      key: 'hide',
      label: 'Hide non-focal slides with',
      values: ['inert', 'none']
    }
  ],
  build(deck, value) {
    const { axis, vp, track, n } = deck;
    vp.classList.add('fade');
    const vertical = vp.classList.contains('vertical');
    const slides: HTMLElement[] = [];
    const targets: HTMLElement[] = [];
    for (let i = 0; i < n; i++) {
      const target = document.createElement('div');
      target.className = 'target';
      target.setAttribute('aria-hidden', 'true');
      target.style.gridArea = vertical ? `${i + 1} / 1` : `1 / ${i + 1}`;
      targets.push(target);
      slides.push(makeSlide(i, deck));
    }
    track.append(...targets, ...slides);
    track.style.setProperty('--slides', String(n));
    for (const slide of slides) {
      slide.style[vertical ? 'gridRow' : 'gridColumn'] = `1 / span ${n}`;
    }

    const progress = () => axis.pos / axis.viewSize;
    const css = value('driver') === 'css' && cssTimelines;
    const useInert = value('hide') === 'inert';

    if (css) {
      vp.classList.add('css-driven');
      vp.style.setProperty(
        'timeline-scope',
        targets.map((_, i) => `--t${i}`).join(', ')
      );
      targets.forEach((t, i) =>
        t.style.setProperty(
          'view-timeline',
          `--t${i} ${vertical ? 'block' : 'inline'}`
        )
      );
      slides.forEach((s, i) =>
        s.style.setProperty('animation-timeline', `--t${i}`)
      );
    }

    let raf = 0;
    const paint = () => {
      raf = 0;
      const p = progress();
      slides.forEach((s, i) => {
        const opacity = Math.max(0, 1 - Math.abs(p - i));
        if (!css) s.style.opacity = String(opacity);
        // Stacked slides would catch clicks meant for the visible one.
        s.style.pointerEvents = opacity > 0.5 ? '' : 'none';
      });
    };
    vp.addEventListener(
      'scroll',
      () => (raf ||= requestAnimationFrame(paint)),
      {
        passive: true
      }
    );

    const focal = () => Math.min(n - 1, Math.max(0, Math.round(progress())));
    let shown = -1;
    const hide = () => {
      const f = focal();
      if (!useInert || f === shown) return;
      shown = f;
      slides.forEach((s, i) => (s.inert = i !== f));
    };
    paint();
    hide();

    return {
      loops: false,
      logical: progress,
      focal,
      settle: hide,
      goTo: (index) => {
        axis.pos = index * axis.viewSize;
      },
      status: () => describe(deck, css, value('driver'))
    };
  }
});

function describe(deck: Deck, css: boolean, asked: string) {
  const driver = css
    ? 'CSS view timelines'
    : asked === 'css'
      ? 'JS (CSS view timelines unsupported here)'
      : 'JS scroll listener';
  return `${deck.n} slides stacked · opacity from ${driver}`;
}
