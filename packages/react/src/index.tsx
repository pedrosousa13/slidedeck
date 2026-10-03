import type { ComponentProps } from 'react';

// Placeholder: proves the package builds, packs, tests and renders in a story.
// The tracer-bullet issue (#6) replaces it with the real primitive.
export function Root(props: ComponentProps<'div'>) {
  return <div data-slidedeck-root="" {...props} />;
}
