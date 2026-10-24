import test from 'node:test';
import assert from 'node:assert';
import { parse } from '../../src/main/link';

test('a spot from Startbar\'s tray button', () => {
  assert.deepStrictEqual(parse('shotdrawer://show?x=1240&y=820&edge=bottom'), { action: 'show', spot: { x: 1240, y: 820, edge: 'bottom' } });
});

test('the edge is bottom unless it says top, and points round', () => {
  assert.deepStrictEqual(parse('shotdrawer://show?x=10.6&y=-4.2')?.spot, { x: 11, y: -4, edge: 'bottom' });
  assert.strictEqual(parse('shotdrawer://show?x=1&y=2&edge=top')?.spot?.edge, 'top');
});

test('no spot, or a spot that isn\'t numbers, opens under the menu bar icon', () => {
  assert.deepStrictEqual(parse('shotdrawer://show'), { action: 'show', spot: null });
  assert.deepStrictEqual(parse('shotdrawer://show?x=&y=5'), { action: 'show', spot: null });
  assert.deepStrictEqual(parse('shotdrawer://show?x=left&y=5'), { action: 'show', spot: null });
});

test('other links are left alone', () => {
  assert.strictEqual(parse('shotdrawer://delete?x=1&y=2'), null);
  assert.strictEqual(parse('https://example.com/show?x=1&y=2'), null);
  assert.strictEqual(parse('not a link'), null);
});
