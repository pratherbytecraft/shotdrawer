const test = require('node:test');
const assert = require('node:assert');
const { clean } = require('../../src/main/settings');

test('keeps known keys with good values', () => {
  assert.deepStrictEqual(clean({ historySize: 40, layout: 'grid' }), { historySize: 40, layout: 'grid' });
});

test('keeps the copy format and where Show in opens', () => {
  assert.deepStrictEqual(clean({ copyFormat: 'quoted', showIn: 'finder' }), { copyFormat: 'quoted', showIn: 'finder' });
  assert.deepStrictEqual(clean({ copyFormat: 'csv', showIn: 'path finder' }), {});
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
