// THROWAWAY (#3). "The scroller came to rest": `scrollend` where it exists,
// else 150 ms without a `scroll` event.

export const settleSource: 'scrollend' | 'debounce' =
  'onscrollend' in window ? 'scrollend' : 'debounce';

export function onSettle(el: HTMLElement, fn: () => void): void {
  if (settleSource === 'scrollend') {
    el.addEventListener('scrollend', fn);
    return;
  }
  let timer = 0;
  el.addEventListener(
    'scroll',
    () => {
      clearTimeout(timer);
      timer = window.setTimeout(fn, 150);
    },
    { passive: true }
  );
}
