import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as settings from '../../src/main/settings';
import { clean } from '../../src/main/settings';

test('keeps known keys with good values', () => {
  assert.deepStrictEqual(clean({ historySize: 40, layout: 'grid' }), { historySize: 40, layout: 'grid' });
});

test('keeps the copy format and where Show in opens', () => {
  assert.deepStrictEqual(clean({ copyFormat: 'quoted', showIn: 'finder' }), { copyFormat: 'quoted', showIn: 'finder' });
  assert.deepStrictEqual(clean({ copyFormat: 'csv', showIn: 'path finder' }), {});
});

test('keeps the big look switch', () => {
  assert.deepStrictEqual(clean({ bigLook: false }), { bigLook: false });
});

test('keeps the close after copying switch', () => {
  assert.deepStrictEqual(clean({ closeAfterCopy: false }), { closeAfterCopy: false });
  assert.deepStrictEqual(clean({ closeAfterCopy: 'no' }), {});
});

test('keeps the menu bar icon choice', () => {
  assert.deepStrictEqual(clean({ menuBarIcon: 'always' }), { menuBarIcon: 'always' });
  assert.deepStrictEqual(clean({ menuBarIcon: 'never' }), {});
});

test('drops unknown keys and values of the wrong kind', () => {
  assert.deepStrictEqual(clean({ historySize: '40', layout: 'tiles', other: 1 }), {});
  assert.deepStrictEqual(clean(null), {});
  assert.deepStrictEqual(clean([1]), {});
});

test('the history size stays within 5 to 100 in steps of 5', () => {
  assert.strictEqual(clean({ historySize: 0 }).historySize, 5);
  assert.strictEqual(clean({ historySize: 500 }).historySize, 100);
  assert.strictEqual(clean({ historySize: 23 }).historySize, 25);
  assert.deepStrictEqual(clean({ historySize: NaN }), {});
});

test('only the launch with no settings file counts as the first', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotdrawer-test-'));
  try {
    settings.init(dir);
    assert.ok(settings.firstRun());
    assert.ok(fs.existsSync(path.join(dir, 'settings.json')));
    settings.init(dir);
    assert.ok(!settings.firstRun());
    settings.update({ layout: 'grid' });
    assert.strictEqual(settings.init(dir).layout, 'grid');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
