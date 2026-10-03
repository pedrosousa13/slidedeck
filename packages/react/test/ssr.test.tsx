import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { nextFrame, TestDeck, viewportOf, WIDTH } from './fixtures';

const rectsOf = (elements: Element[]) =>
  elements.map((el) => el.getBoundingClientRect().toJSON());

test('server-rendered output starting at defaultIndex shows no layout shift', async () => {
  const deck = <TestDeck defaultIndex={2} />;
  const container = document.createElement('div');
  container.innerHTML = renderToString(deck);
  document.body.append(container);

  // Before any script runs, the server HTML alone is at defaultIndex.
  const viewport = viewportOf(container);
  expect(viewport.scrollLeft).toBe(2 * WIDTH);
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
      <TestDeck defaultIndex={2} onIndexChange={onIndexChange} />,
      {
        onRecoverableError
      }
    );
  });
  await nextFrame();
  await nextFrame();
  shifts.push(...observer.takeRecords());
  observer.disconnect();

  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(shifts).toEqual([]);
  expect(rectsOf([container, ...slides])).toEqual(before);
  expect(viewport.scrollLeft).toBe(2 * WIDTH);
  expect(viewport.closest('[data-index]')?.getAttribute('data-index')).toBe(
    '2'
  );
  expect(onIndexChange).not.toHaveBeenCalled();
});
