// The entry a React Server Components bundler resolves for a server
// component (the `react-server` condition). It is no client module: Deck.Root
// here renders in the server component, where the Deck.Viewport among its
// children is still recognisable, as the client reference it imports below,
// and counts its slides for the client Root. Everything else is the client
// entry's own.
import { Root as ClientRoot, Viewport, type RootProps } from './index.js';
import { ServerSlidesProvider } from './server-slides.js';
import { slidesIn } from './slides-in.js';

export * from './index.js';

export function Root(props: RootProps) {
  const slides = slidesIn(props.children, Viewport);
  if (slides === null) return <ClientRoot {...props} />;
  return (
    <ServerSlidesProvider count={slides}>
      <ClientRoot {...props} />
    </ServerSlidesProvider>
  );
}
