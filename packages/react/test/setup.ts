import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount every render, and drop containers a test appended itself (the
// server-render tests), so one test's deck never answers another's query.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});
