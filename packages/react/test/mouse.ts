import { commands } from 'vitest/browser';
import { toPage } from './fixtures';

/** A step of real mouse input: a move to a point, in `steps` moves; the
 * left button pressed or released; a wheel by `dx`, `dy`; or a wait of
 * `ms`. */
export type MouseStep =
  | ['move', x: number, y: number, steps?: number]
  | ['down' | 'up']
  | ['wheel', dx: number, dy: number]
  | ['wait', ms: number];

declare module 'vitest/browser' {
  interface BrowserCommands {
    mouse: (steps: MouseStep[]) => Promise<void>;
  }
}

/**
 * Real mouse input (Playwright's, see `vitest.config.ts`), in Chromium,
 * Firefox or WebKit, at points in this page.
 */
export function mouse(...steps: MouseStep[]) {
  return commands.mouse(
    steps.map((step) => {
      if (step[0] !== 'move') return step;
      const { x, y } = toPage(step[1], step[2]);
      return ['move', x, y, step[3]];
    })
  );
}
