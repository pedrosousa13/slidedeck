import { expect, test } from 'vitest';
import * as core from '@slidedeck/core';

// A placeholder that proves the package builds, resolves and tests. The
// tracer-bullet issue (#6) replaces it with the engine.
test('exports its own name', () => {
  expect(core.name).toBe('@slidedeck/core');
});
