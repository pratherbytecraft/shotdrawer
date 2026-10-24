import test from 'node:test';
import assert from 'node:assert';
import { decide } from '../../src/main/startbar';

test('Startbar running a version with the button shows it unless it\'s switched off', () => {
  assert.strictEqual(decide({ running: true, version: '0.2.17', settings: {} }), true);
  assert.strictEqual(decide({ running: true, version: '0.3.0', settings: { tray: { volume: true } } }), true);
  assert.strictEqual(decide({ running: true, version: '0.2.17', settings: { tray: { shotdrawer: false } } }), false);
});

test('no button from a Startbar that isn\'t running, is older, or can\'t be read', () => {
  assert.strictEqual(decide({ running: false, version: '0.2.17', settings: {} }), false);
  assert.strictEqual(decide({ running: true, version: '0.2.16', settings: {} }), false);
  assert.strictEqual(decide({ running: true, version: null, settings: null }), false);
});

test('no settings file yet means the button is on, its default', () => {
  assert.strictEqual(decide({ running: true, version: '0.2.17', settings: null }), true);
});
