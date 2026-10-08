// Draws the site's icons from icons/icon.svg: favicon.ico, which
// build.favicon serves at /favicon.ico, and public/apple-touch-icon.png, the
// address iOS asks for. Run it after changing the SVG, and commit what it
// writes:
//
//   node apps/site/icons/draw.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const ICONS = import.meta.dirname;
const svg = readFileSync(join(ICONS, 'icon.svg'), 'utf8');

const png = (source: string, size: number) =>
  new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();

/** An .ico holding each PNG as it is: every browser reads PNG entries. */
function ico(images: readonly { size: number; png: Uint8Array }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  for (const [i, { size, png }] of images.entries()) {
    const at = 6 + 16 * i;
    header.writeUInt8(size, at);
    header.writeUInt8(size, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  }
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

writeFileSync(
  join(ICONS, 'favicon.ico'),
  ico([16, 32, 48].map((size) => ({ size, png: png(svg, size) })))
);

// iOS draws a transparent icon on black and rounds the corners itself, so
// the touch icon is the mark on the site's ground, square, with a margin.
const touch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#ffffff"/>
  <svg x="5" y="5" width="22" height="22" viewBox="0 0 32 32">${svg.replace(/<\/?svg[^>]*>/g, '')}</svg>
</svg>`;
writeFileSync(
  join(ICONS, '..', 'public', 'apple-touch-icon.png'),
  png(touch, 180)
);
