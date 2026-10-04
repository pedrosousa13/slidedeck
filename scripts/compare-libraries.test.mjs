import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderTable, spliceTable } from './compare-libraries.mjs';

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
