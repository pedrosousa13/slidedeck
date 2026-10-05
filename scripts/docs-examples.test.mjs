import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractExamples } from './docs-examples.mjs';

test('extractExamples takes every ts and tsx block, with the line it starts on', () => {
  const markdown = [
    '# Title', // 1
    '', // 2
    '```tsx', // 3
    'const a = <div />;', // 4
    '```', // 5
    '', // 6
    '```ts', // 7
    'const b = 1;', // 8
    'const c = 2;', // 9
    '```' // 10
  ].join('\n');
  assert.deepEqual(extractExamples(markdown), [
    { line: 4, language: 'tsx', code: 'const a = <div />;\n', file: undefined },
    {
      line: 8,
      language: 'ts',
      code: 'const b = 1;\nconst c = 2;\n',
      file: undefined
    }
  ]);
});

test('extractExamples skips blocks in other languages', () => {
  const markdown = ['```sh', 'pnpm add x', '```', '```css', 'a {}', '```'];
  assert.deepEqual(extractExamples(markdown.join('\n')), []);
});

test('an example marker names the file a block must match', () => {
  const markdown = [
    '<!-- example: apps/storybook/stories/recipe.tsx -->',
    '',
    '```tsx',
    'export {};',
    '```'
  ].join('\n');
  assert.deepEqual(extractExamples(markdown), [
    {
      line: 4,
      language: 'tsx',
      code: 'export {};\n',
      file: 'apps/storybook/stories/recipe.tsx'
    }
  ]);
});

test('a marker holds a css block to its file too', () => {
  const markdown = [
    '<!-- example: apps/storybook/stories/recipe.css -->',
    '```css',
    'a {}',
    '```'
  ].join('\n');
  assert.deepEqual(extractExamples(markdown), [
    {
      line: 3,
      language: 'css',
      code: 'a {}\n',
      file: 'apps/storybook/stories/recipe.css'
    }
  ]);
});

test('a marker applies to the next block only', () => {
  const markdown = [
    '<!-- example: a.tsx -->',
    '```tsx',
    'export {};',
    '```',
    '```tsx',
    'export {};',
    '```'
  ].join('\n');
  assert.deepEqual(
    extractExamples(markdown).map((example) => example.file),
    ['a.tsx', undefined]
  );
});

test('an unclosed block is an error, not a silent skip', () => {
  assert.throws(() => extractExamples('```tsx\nconst a = 1;\n'), /line 1/);
});
