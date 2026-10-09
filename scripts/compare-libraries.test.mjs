import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  renderTable,
  spliceDocsTable,
  spliceTable,
  versionCell
} from './compare-libraries.mjs';

const row = {
  name: '`a-lib`',
  version: '1.0.0',
  bytes: 2048,
  nativeScroll: 'Yes',
  accessibility: 'Some',
  api: 'A hook'
};

test('renderTable prints one row per library, its size in KB', () => {
  const table = renderTable([row, { ...row, name: '`b`', bytes: 512 }]);
  const lines = table.split('\n');
  assert.equal(lines.length, 4);
  assert.match(lines[0] ?? '', /^\| Library +\| Version +\| Min\+gzip/);
  assert.match(lines[2] ?? '', /^\| `a-lib` +\| 1\.0\.0 +\| 2\.00 KB +\| Yes/);
  assert.match(lines[3] ?? '', /\| 0\.50 KB +\|/);
});

test('renderTable pads every column so the table is aligned', () => {
  const lines = renderTable([row, { ...row, name: '`a-much-longer-name`' }])
    .split('\n')
    .map((line) => line.length);
  assert.equal(new Set(lines).size, 1);
});

const readme = [
  '# Title',
  '',
  '<!-- comparison:start -->',
  'old table',
  '<!-- comparison:end -->',
  '',
  'After.'
].join('\n');

test('spliceTable replaces what lies between the markers, and only that', () => {
  assert.equal(
    spliceTable(readme, '| new |'),
    [
      '# Title',
      '',
      '<!-- comparison:start -->',
      '',
      '| new |',
      '',
      '<!-- comparison:end -->',
      '',
      'After.'
    ].join('\n')
  );
});

test('spliceTable is idempotent', () => {
  const once = spliceTable(readme, '| new |');
  assert.equal(spliceTable(once, '| new |'), once);
});

test('spliceTable throws when a marker is missing or out of order', () => {
  assert.throws(() => spliceTable('# No markers', '| t |'), /comparison:start/);
  assert.throws(
    () =>
      spliceTable(
        '<!-- comparison:end -->\n<!-- comparison:start -->',
        '| t |'
      ),
    /comparison:start/
  );
});

test('spliceDocsTable replaces the page from its first table row on', () => {
  const page = [
    '---',
    'title: T',
    '---',
    '',
    'Intro.',
    '',
    '| old |',
    '',
    'Notes.',
    ''
  ];
  assert.equal(
    spliceDocsTable(page.join('\n'), '| new |\n\nNew notes.'),
    [
      '---',
      'title: T',
      '---',
      '',
      'Intro.',
      '',
      '| new |',
      '',
      'New notes.',
      ''
    ].join('\n')
  );
  assert.throws(() => spliceDocsTable('Intro.\n', '| t |'), /compare\.md/);
});

test("versionCell gives slidedeck's own packages no version, so a release never stales the table", () => {
  const read = () => '9.9.9';
  assert.equal(versionCell('@slidedeck/react', read), 'this repo');
  assert.equal(versionCell('keen-slider', read), '9.9.9');
});
