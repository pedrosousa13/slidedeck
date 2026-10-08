// The social card each page shares with: a 1200 by 630 PNG in the site's
// look, drawn by build.socialImages. @pagedeck/social-image draws a dark card
// with no way to change its colours or add a mark, so this is a renderer of
// our own, on the same two libraries it uses: satori lays the card out as an
// SVG, resvg paints it.
//
// The site sets text in the system stack, which a build machine has no file
// for, and satori shapes only the fonts it is given. Inter, under the SIL Open
// Font License, is the nearest freely licensed face to SF Pro.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { SocialImageAdapter } from '@pagedeck/core';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

const WIDTH = 1200;
const HEIGHT = 630;

const COLOUR = {
  ground: '#f5f5f7',
  text: '#1d1d1f',
  secondary: '#6e6e73',
  accent: '#0071e3',
  slide: '#d2d2d7'
} as const;

const require = createRequire(import.meta.url);
const font = (weight: 400 | 600) => ({
  name: 'Inter',
  weight,
  style: 'normal' as const,
  data: readFileSync(
    require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`)
  )
});
const FONTS = [font(400), font(600)];

// satori walks a tree shaped like React elements, and refuses a box without
// `display: flex`.
type Node = { type: string; props: Record<string, unknown> };
const box = (style: Record<string, unknown>, children?: unknown): Node => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children }
});

/** The site's mark: three rounded slides, the middle one in the accent. */
const mark = (scale: number) =>
  box({ alignItems: 'center', gap: 2 * scale }, [
    box({
      width: 7 * scale,
      height: 14 * scale,
      borderRadius: 2 * scale,
      backgroundColor: COLOUR.slide
    }),
    box({
      width: 12 * scale,
      height: 22 * scale,
      borderRadius: 3 * scale,
      backgroundColor: COLOUR.accent
    }),
    box({
      width: 7 * scale,
      height: 14 * scale,
      borderRadius: 2 * scale,
      backgroundColor: COLOUR.slide
    })
  ]);

function card(headline: string, eyebrow: string | undefined, host: string) {
  return box(
    {
      flexDirection: 'column',
      justifyContent: 'space-between',
      width: '100%',
      height: '100%',
      padding: '64px 72px',
      backgroundColor: COLOUR.ground,
      color: COLOUR.text,
      fontFamily: 'Inter',
      borderBottom: `16px solid ${COLOUR.accent}`
    },
    [
      box({ alignItems: 'center', gap: 20 }, [
        mark(2),
        box(
          { fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em' },
          'slidedeck'
        )
      ]),
      box({ flexDirection: 'column', gap: 20 }, [
        ...(eyebrow === undefined
          ? []
          : [box({ fontSize: 32, color: COLOUR.accent }, eyebrow)]),
        box(
          {
            fontSize: headline.length > 40 ? 64 : 80,
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: '-0.025em'
          },
          headline
        )
      ]),
      box({ fontSize: 28, color: COLOUR.secondary }, host)
    ]
  );
}

/**
 * The card renderer. Each page's `inputs` give its `headline`, and an
 * `eyebrow` above it where the page has one.
 */
export function socialCard(origin: string): SocialImageAdapter {
  const host = new URL(origin).host;
  return {
    name: 'slidedeck social card',
    async draw({ inputs, title }) {
      const headline =
        typeof inputs['headline'] === 'string' ? inputs['headline'] : title;
      if (headline === undefined) {
        throw new Error('Social card: the page has no headline to draw.');
      }
      const eyebrow =
        typeof inputs['eyebrow'] === 'string' ? inputs['eyebrow'] : undefined;
      const svg = await satori(
        card(headline, eyebrow, host) as Parameters<typeof satori>[0],
        { width: WIDTH, height: HEIGHT, fonts: FONTS, embedFont: true }
      );
      const bytes = new Resvg(svg, {
        font: { loadSystemFonts: false, defaultFontFamily: 'Inter' }
      })
        .render()
        .asPng();
      return { bytes, width: WIDTH, height: HEIGHT };
    }
  };
}
