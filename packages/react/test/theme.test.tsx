import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Deck from '@slidedeck/react';
import theme from '@slidedeck/react/theme.css?inline';
import { addStyle, parkMouse, setReducedMotion, TestDeck } from './fixtures';

// The theme's defaults, as the browser computes them.
const ACCENT = 'rgb(11, 92, 213)';
const DOT = 'rgb(118, 118, 118)';
const TEXT = 'rgb(26, 26, 26)';
const SURFACE = 'rgb(255, 255, 255)';
const HOVER = 'rgb(240, 240, 240)';

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
    expect(style(dots[1]!).borderTopLeftRadius).toBe('50%');
    // A 24px target (WCAG 2.5.8), however small the dot drawn in it.
    expect(style(dots[1]!).width).toBe('24px');
  });

  test('styles the counter', () => {
    addStyle(theme);
    const { counter } = renderDeck();

    expect(style(counter).color).toBe(TEXT);
    expect(style(counter).fontSize).toBe('14px');
  });

  test('styles the autoplay toggle as a control', () => {
    addStyle(theme);
    const { toggle } = renderDeck();

    expect(style(toggle).backgroundColor).toBe(SURFACE);
    expect(style(toggle).borderTopLeftRadius).toBe('6px');
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
    const { next } = renderDeck();
    expect(style(next).transitionDuration).not.toBe('0s');

    await setReducedMotion(true);
    onTestFinished(() => setReducedMotion(false));

    expect(style(next).transitionDuration).toBe('0s');
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
    const uses = [...theme.matchAll(/var\((--[\w-]+)(?:,\s*([^)]*))?\)/g)];

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
