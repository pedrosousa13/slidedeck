import { Children, Fragment, isValidElement, type ReactNode } from 'react';

/** The slides in the first `viewport` element among `children`, looking
 * through elements and fragments but not into components, which cannot be
 * rendered ahead of time; null if none is found. Counted as Deck.Viewport
 * counts them. `viewport` is Deck.Viewport as the caller sees it: the
 * component in client code, a client reference in a server component. */
export function slidesIn(
  children: ReactNode,
  viewport: unknown
): number | null {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (child.type === viewport) {
      return Children.toArray(child.props.children).length;
    }
    if (typeof child.type !== 'string' && child.type !== Fragment) continue;
    const found = slidesIn(child.props.children, viewport);
    if (found !== null) return found;
  }
  return null;
}
