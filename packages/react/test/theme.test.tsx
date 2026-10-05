import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import theme from '@slidedeck/react/theme.css?inline';
import {
  addStyle,
  parkMouse,
  setForcedColors,
  setReducedMotion,
  TestDeck
} from './fixtures';

// The theme's defaults, as the browser computes them.
const ACCENT = 'rgb(11, 92, 213)';
const DOT = 'rgb(118, 118, 118)';
const TEXT = 'rgb(26, 26, 26)';
const SURFACE = 'rgb(255, 255, 255)';
const HOVER = 'rgb(240, 240, 240)';
const ON_ACCENT = 'rgb(255, 255, 255)';
const DOT_HOVER = 'rgb(26, 26, 26)';

// WCAG 2.2's contrast ratio between two computed `rgb()` colours.
const contrast = (a: string, b: string) => {
  const luminance = (color: string) => {
    const [r, g, b] = color
      .match(/\d+/g)!
      .slice(0, 3)
      .map((c) => {
        const s = Number(c) / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
};

beforeEach(parkMouse);

const renderDeck = (props: Parameters<typeof TestDeck>[0] = {}) => {
  render(
    <TestDeck
      autoplay={60_000}
      controls={
        <>
          <Deck.Dots />
          <Deck.Counter />
          <Deck.AutoplayToggle />
        </>
      }
      {...props}
    />
  );
  const root = screen.getByRole('region', { name: 'Test deck' });
  const group = within(root).getByRole('group', { name: 'Choose page' });
  return {
    root,
    prev: within(root).getByRole('button', { name: 'Previous' }),
    next: within(root).getByRole('button', { name: 'Next' }),
    dots: within(group).getAllByRole('button'),
    counter: root.querySelector<HTMLElement>('[data-slidedeck-counter]')!,
    toggle: root.querySelector<HTMLElement>('[data-slidedeck-autoplay-toggle]')!
  };
};

const style = (el: Element) => getComputedStyle(el);

test('Prev and Next are marked for CSS to select', () => {
  const { prev, next } = renderDeck();

  expect(prev.hasAttribute('data-slidedeck-prev')).toBe(true);
  expect(next.hasAttribute('data-slidedeck-next')).toBe(true);
});

describe('theme.css', () => {
  test('styles Prev and Next', () => {
    addStyle(theme);
    const { next } = renderDeck();

    expect(style(next).color).toBe(TEXT);
    expect(style(next).backgroundColor).toBe(SURFACE);
    expect(style(next).borderTopColor).toBe(DOT);
    expect(style(next).borderTopLeftRadius).toBe('6px');
  });

  test('a disabled Prev looks different from an enabled Next', () => {
    addStyle(theme);
    const { prev, next } = renderDeck();

    expect(style(prev).opacity).toBe('0.4');
    expect(style(next).opacity).toBe('1');
  });

  test('a hovered control changes its background', async () => {
    addStyle(theme);
    await setReducedMotion(true);
    onTestFinished(() => setReducedMotion(false));
    const { next } = renderDeck();

    await userEvent.hover(next);

    await expect.poll(() => style(next).backgroundColor).toBe(HOVER);
  });

  test('styles the dots, the current one in the accent', () => {
    addStyle(theme);
    const { dots } = renderDeck();

    expect(style(dots[0]!).backgroundColor).toBe(ACCENT);
    expect(style(dots[1]!).backgroundColor).toBe(DOT);
    // A radius past half the side rounds a dot to a circle, and the current
    // one, wider, to a pill.
    expect(style(dots[1]!).borderTopLeftRadius).toBe('9999px');
    // A 24px target (WCAG 2.5.8), however small the dot drawn in it.
    expect(style(dots[1]!).width).toBe('24px');
  });

  test('the current dot is wider than the others, not only another colour', () => {
    addStyle(theme);
    const { dots } = renderDeck();
    const drawn = (dot: Element) =>
      parseFloat(style(dot).width) -
      parseFloat(style(dot).paddingLeft) -
      parseFloat(style(dot).paddingRight);

    // WCAG 1.4.1: the accent alone is too close to the dot grey to tell.
    expect(drawn(dots[0]!)).toBe(20);
    expect(drawn(dots[1]!)).toBe(10);
    expect(style(dots[0]!).height).toBe(style(dots[1]!).height);
  });

  test("a token sets the dots' corner radius", () => {
    addStyle(theme);
    addStyle('.square { --deck-dot-radius: 0px; }');
    const { dots } = renderDeck({ className: 'square' });

    expect(style(dots[1]!).borderTopLeftRadius).toBe('0px');
  });

  test('under forced colours, the dots show and the current one stands out', async () => {
    addStyle(theme);
    await setForcedColors(true);
    onTestFinished(() => setForcedColors(false));
    const { dots } = renderDeck();
    const canvas = document.createElement('div');
    canvas.style.backgroundColor = 'Canvas';
    document.body.append(canvas);
    onTestFinished(() => canvas.remove());
    const page = style(canvas).backgroundColor;

    expect(style(dots[1]!).backgroundColor).not.toBe(page);
    expect(style(dots[0]!).backgroundColor).not.toBe(page);
    expect(style(dots[0]!).backgroundColor).not.toBe(
      style(dots[1]!).backgroundColor
    );
  });

  test('styles the counter', () => {
    addStyle(theme);
    const { counter } = renderDeck();

    expect(style(counter).color).toBe(TEXT);
    expect(style(counter).fontSize).toBe('14px');
  });

  test('a paused autoplay toggle looks like any other control', async () => {
    addStyle(theme);
    // Autoplay starts stopped under reduced motion.
    await setReducedMotion(true);
    onTestFinished(() => setReducedMotion(false));
    const { toggle } = renderDeck();

    expect(toggle.hasAttribute('data-playing')).toBe(false);
    expect(style(toggle).backgroundColor).toBe(SURFACE);
    expect(style(toggle).color).toBe(TEXT);
    expect(style(toggle).borderTopLeftRadius).toBe('6px');
  });

  test('a playing autoplay toggle is filled with the accent', () => {
    addStyle(theme);
    const { toggle } = renderDeck();

    expect(toggle.hasAttribute('data-playing')).toBe(true);
    expect(style(toggle).backgroundColor).toBe(ACCENT);
    expect(style(toggle).color).toBe(ON_ACCENT);
  });

  test('under a pointer, the playing toggle still differs from the paused one', async () => {
    addStyle(theme);
    await setReducedMotion(true);
    onTestFinished(() => setReducedMotion(false));
    const { toggle } = renderDeck();

    await userEvent.hover(toggle);
    await expect.poll(() => style(toggle).backgroundColor).toBe(HOVER);

    await userEvent.click(toggle);
    expect(toggle.hasAttribute('data-playing')).toBe(true);
    await expect.poll(() => style(toggle).backgroundColor).toBe(ACCENT);
    expect(style(toggle).color).toBe(ON_ACCENT);
  });

  test("tokens set the playing toggle's fill and text", () => {
    addStyle(theme);
    addStyle(`.branded {
      --deck-control-active-background: rgb(1, 2, 3);
      --deck-control-active-color: rgb(4, 5, 6);
    }`);
    const { toggle } = renderDeck({ className: 'branded' });

    expect(style(toggle).backgroundColor).toBe('rgb(1, 2, 3)');
    expect(style(toggle).color).toBe('rgb(4, 5, 6)');
  });

  test('the playing toggle follows the accent', () => {
    addStyle(theme);
    addStyle('.branded { --deck-accent: rgb(1, 2, 3); }');
    const { toggle } = renderDeck({ className: 'branded' });

    expect(style(toggle).backgroundColor).toBe('rgb(1, 2, 3)');
  });

  test('hovering a dot that is not current changes it; the current one stays', async () => {
    addStyle(theme);
    await setReducedMotion(true);
    onTestFinished(() => setReducedMotion(false));
    const { dots } = renderDeck();

    await userEvent.hover(dots[1]!);
    await expect.poll(() => style(dots[1]!).backgroundColor).toBe(DOT_HOVER);
    expect(style(dots[2]!).backgroundColor).toBe(DOT);

    await userEvent.hover(dots[0]!);
    await expect.poll(() => style(dots[1]!).backgroundColor).toBe(DOT);
    expect(style(dots[0]!).backgroundColor).toBe(ACCENT);
  });

  test("a token sets a hovered dot's colour", async () => {
    addStyle(theme);
    addStyle('.branded { --deck-dot-hover-color: rgb(1, 2, 3); }');
    await setReducedMotion(true);
    onTestFinished(() => setReducedMotion(false));
    const { dots } = renderDeck({ className: 'branded' });

    await userEvent.hover(dots[1]!);

    await expect
      .poll(() => style(dots[1]!).backgroundColor)
      .toBe('rgb(1, 2, 3)');
  });

  test('the default colours meet WCAG contrast', () => {
    // Text 4.5:1 (1.4.3); a control's fill and a dot against the page 3:1
    // (1.4.11).
    expect(contrast(ON_ACCENT, ACCENT)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ACCENT, SURFACE)).toBeGreaterThanOrEqual(3);
    expect(contrast(DOT_HOVER, SURFACE)).toBeGreaterThanOrEqual(3);
  });

  test('under forced colours, the playing toggle stands out and a hovered dot shows', async () => {
    addStyle(theme);
    await setForcedColors(true);
    onTestFinished(() => setForcedColors(false));
    const { next, toggle, dots } = renderDeck();

    expect(toggle.hasAttribute('data-playing')).toBe(true);
    expect(style(toggle).backgroundColor).not.toBe(style(next).backgroundColor);
    expect(style(toggle).color).not.toBe(style(toggle).backgroundColor);

    await userEvent.hover(dots[1]!);
    await expect
      .poll(() => style(dots[1]!).backgroundColor)
      .not.toBe(style(dots[2]!).backgroundColor);
  });

  test('a control focused from the keyboard shows a focus ring', async () => {
    addStyle(theme);
    const { dots, toggle } = renderDeck();
    dots.at(-1)!.focus();

    await userEvent.keyboard('{Tab}');

    expect(document.activeElement).toBe(toggle);
    expect(style(toggle).outlineStyle).toBe('solid');
    expect(style(toggle).outlineColor).toBe(ACCENT);
    expect(style(toggle).outlineWidth).toBe('2px');
  });

  test('a token set on an ancestor overrides its default', () => {
    addStyle(theme);
    addStyle('.branded { --deck-accent: rgb(1, 2, 3); }');
    const { dots } = renderDeck({ className: 'branded' });

    expect(style(dots[0]!).backgroundColor).toBe('rgb(1, 2, 3)');
  });

  test('transitions are off under reduced motion', async () => {
    addStyle(theme);
    const { next, toggle, dots } = renderDeck();
    expect(style(next).transitionDuration).not.toBe('0s');

    await setReducedMotion(true);
    onTestFinished(() => setReducedMotion(false));

    expect(style(next).transitionDuration).toBe('0s');
    expect(style(toggle).transitionDuration).toBe('0s');
    expect(style(dots[1]!).transitionDuration).toBe('0s');
  });

  test('consumer CSS beats the theme without raising specificity', () => {
    addStyle(theme);
    addStyle('button { background-color: rgb(4, 5, 6); }');
    const { next } = renderDeck();

    expect(style(next).backgroundColor).toBe('rgb(4, 5, 6)');
  });

  test('every custom property it reads is documented, with its default', () => {
    const header = theme.slice(0, theme.indexOf('*/'));
    const documented = new Map(
      [...header.matchAll(/^\s*\*\s+(--[\w-]+):\s*(.+?)\s*$/gm)].map(
        ([, name, value]) => [name!, value!]
      )
    );
    // A default may itself be a var(), one level deep.
    const uses = [
      ...theme.matchAll(/var\(\s*(--[\w-]+)(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g)
    ];

    expect(uses.length).toBeGreaterThan(0);
    for (const [, name, fallback] of uses) {
      expect(documented.has(name!), `${name} is documented`).toBe(true);
      expect(fallback?.trim(), `${name}'s default`).toBe(documented.get(name!));
    }
    expect(new Set(uses.map(([, name]) => name))).toEqual(
      new Set(documented.keys())
    );
  });
});
