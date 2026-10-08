import { commands } from 'vitest/browser';

/** A step of real mouse input: a move to a point, in `steps` moves; the
 * left button pressed or released; or a wait of `ms`. */
export type MouseStep =
  | ['move', x: number, y: number, steps?: number]
  | ['down' | 'up']
  | ['wait', ms: number];

declare module 'vitest/browser' {
  interface BrowserCommands {
    mouse: (steps: MouseStep[]) => Promise<void>;
  }
}

/**
 * Real mouse input (Playwright's, see `vitest.config.ts`), in Chromium,
 * Firefox or WebKit. Takes points in this page: vitest scales the test
 * iframe in the top page.
 */
export function mouse(...steps: MouseStep[]) {
  const frame = window.frameElement!.getBoundingClientRect();
  const scale = frame.width / window.innerWidth;
  return commands.mouse(
    steps.map((step) =>
      step[0] === 'move'
        ? [
            'move',
            frame.x + step[1] * scale,
            frame.y + step[2] * scale,
            step[3]
          ]
        : step
    )
  );
}
