import { act, type ComponentProps } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { nextFrame, TestDeck, viewportOf, WIDTH } from './fixtures';

type DeckProps = ComponentProps<typeof TestDeck>;

const rectsOf = (elements: Element[]) =>
  elements.map((el) => el.getBoundingClientRect().toJSON());

/**
 * Paints the server HTML for `props`, then hydrates it and records what
 * moved. `atServer` reads the viewport before any script has run.
 */
async function hydrate(props: DeckProps, atServer: (v: HTMLElement) => void) {
  const container = document.createElement('div');
  container.innerHTML = renderToString(<TestDeck {...props} />);
  document.body.append(container);
  const viewport = viewportOf(container);
  atServer(viewport);
  await nextFrame();
  const slides = [...viewport.children];
  const before = rectsOf([container, ...slides]);

  const shifts: PerformanceEntry[] = [];
  const observer = new PerformanceObserver((list) =>
    shifts.push(...list.getEntries())
  );
  observer.observe({ type: 'layout-shift' });
  const onRecoverableError = vi.fn();
  const onIndexChange = vi.fn();

  await act(async () => {
    hydrateRoot(
      container,
      <TestDeck {...props} onIndexChange={onIndexChange} />,
      { onRecoverableError }
    );
  });
  await nextFrame();
  await nextFrame();
  shifts.push(...observer.takeRecords());
  observer.disconnect();

  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(shifts).toEqual([]);
  expect(rectsOf([container, ...slides])).toEqual(before);
  expect(onIndexChange).not.toHaveBeenCalled();
  return {
    viewport,
    index: viewport.closest('[data-index]')?.getAttribute('data-index')
  };
}

test('server-rendered output starting at defaultIndex shows no layout shift', async () => {
  const { viewport, index } = await hydrate({ defaultIndex: 2 }, (viewport) =>
    // Before any script runs, the server HTML alone is at defaultIndex.
    expect(viewport.scrollLeft).toBe(2 * WIDTH)
  );

  expect(viewport.scrollLeft).toBe(2 * WIDTH);
  expect(index).toBe('2');
});

let removeStyle = () => {};
afterEach(() => removeStyle());

// 3.5 centred slides in view: slides 0 and 1 both rest at scroll 0, and
// slides 3 and 4 at the end of the range, so 5 slides give 3 snap points.
test.each([
  { defaultIndex: 1, at: 'start', index: '0' },
  { defaultIndex: 10, at: 'end', index: '2' }
])(
  'with snap points shared by several slides, defaultIndex $defaultIndex starts at the $at with no layout shift',
  async ({ defaultIndex, at, index: expected }) => {
    const style = document.createElement('style');
    style.textContent = `.centred > * { width: calc(100% / 3.5); scroll-snap-align: center; }`;
    document.head.append(style);
    removeStyle = () => style.remove();
    let atServer = -1;

    const { viewport, index } = await hydrate(
      { defaultIndex, viewportClassName: 'centred' },
      (viewport) => (atServer = viewport.scrollLeft)
    );

    const max = viewport.scrollWidth - viewport.clientWidth;
    expect(atServer).toBe(at === 'start' ? 0 : max);
    expect(viewport.scrollLeft).toBe(atServer);
    expect(index).toBe(expected);
  }
);
