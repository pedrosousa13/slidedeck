import { createContext, type ReactNode } from 'react';

/** The slides a server component's Deck.Root counted, for the client Root it
 * renders: there Deck.Viewport is a client reference, which the client Root
 * cannot recognise. Null where none were counted. */
export const ServerSlides = createContext<number | null>(null);

/** Provides `ServerSlides`: a server component cannot render a context. */
export function ServerSlidesProvider({
  count,
  children
}: {
  count: number;
  children: ReactNode;
}) {
  return <ServerSlides value={count}>{children}</ServerSlides>;
}
