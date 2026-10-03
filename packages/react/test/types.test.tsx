import { createRef, type ComponentProps } from 'react';
import { expectTypeOf, test } from 'vitest';
import * as Deck from '@slidedeck/react';

// Compile-time checks: `pnpm typecheck` fails if a line expected to error
// compiles, or an unmarked one does not.

const noop = (index: number) => void index;
const Root = Deck.Root;

test('a deck is uncontrolled, or controlled with onIndexChange', () => {
  void (<Root />);
  void (<Root defaultIndex={1} />);
  void (<Root defaultIndex={1} onIndexChange={noop} />);
  void (<Root index={1} onIndexChange={noop} />);

  // @ts-expect-error -- index and defaultIndex are either-or
  void (<Root index={1} defaultIndex={1} onIndexChange={noop} />);
  // @ts-expect-error -- a controlled deck needs onIndexChange
  void (<Root index={1} />);
  // @ts-expect-error -- an index is a number
  void (<Root index="1" onIndexChange={noop} />);
});

test('the ref is a RootHandle, not the div', () => {
  void (<Root ref={createRef<Deck.RootHandle>()} />);
  // @ts-expect-error -- the ref is not the region element
  void (<Root ref={createRef<HTMLDivElement>()} />);

  expectTypeOf<Deck.RootHandle>().toEqualTypeOf<{
    scrollTo(index: number): void;
    next(): void;
    prev(): void;
  }>();
  expectTypeOf<ComponentProps<typeof Root>['onIndexChange']>().toEqualTypeOf<
    ((index: number) => void) | undefined
  >();
});
