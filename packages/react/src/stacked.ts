import type { Effect } from './index.js';

/**
 * The layout of an effect that stacks the slides in one place, as fade and
 * stack do (ADR-0007). Not an entry: each effect that stacks imports it.
 *
 * The slides are stacked with `position: sticky` over an empty snap target
 * per slide, which gives the viewport its scroll length and snap points. Each
 * slide fills the viewport and snaps at its start, so slide size, alignment
 * and group snapping (pages) do not apply.
 */
export const stackedLayout: NonNullable<Effect['layout']> = (
  orientation,
  count
) => {
  const vertical = orientation === 'vertical';
  // The track is as long as the scroll range, and each slide's grid area
  // spans all of it: a sticky box is held inside its grid area.
  const track = `repeat(${Math.max(count, 1)}, 100%)`;
  const along = vertical ? 'gridRow' : 'gridColumn';
  const across = vertical ? 'gridColumn' : 'gridRow';
  return {
    viewport: {
      display: 'grid',
      gridTemplateColumns: vertical ? '100%' : track,
      gridTemplateRows: vertical ? track : '100%'
    },
    slide: {
      [across]: '1',
      [along]: '1 / -1',
      [vertical ? 'alignSelf' : 'justifySelf']: 'start',
      [vertical ? 'height' : 'width']: `calc(100% / ${Math.max(count, 1)})`,
      position: 'sticky',
      [vertical ? 'top' : 'insetInlineStart']: 0,
      // A stuck slide would snap wherever it is stuck: the targets snap.
      scrollSnapAlign: 'none'
    },
    target: (index) => ({
      [across]: '1',
      [along]: String(index + 1),
      scrollSnapAlign: 'start'
    })
  };
};
