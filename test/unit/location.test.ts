import test from 'node:test';
import assert from 'node:assert';
import { parse } from '../../src/main/location';

const HOME = '/Users/sam';

test('the Desktop and Screenshot when nothing is set', () => {
  assert.deepStrictEqual(parse(null, null, HOME), { folder: '/Users/sam/Desktop', prefix: 'Screenshot' });
  assert.deepStrictEqual(parse('', '  ', HOME), { folder: '/Users/sam/Desktop', prefix: 'Screenshot' });
});

test('a folder with spaces as it is', () => {
  assert.strictEqual(parse('/Users/sam/Documents/Temp Screenshots', null, HOME).folder, '/Users/sam/Documents/Temp Screenshots');
});

test('a folder starting with ~ in the home folder', () => {
  assert.strictEqual(parse('~/Pictures/Shots', null, HOME).folder, '/Users/sam/Pictures/Shots');
  assert.strictEqual(parse('~', null, HOME).folder, '/Users/sam');
});

test('a trailing slash and a newline dropped', () => {
  assert.strictEqual(parse('/Users/sam/Shots/\n', null, HOME).folder, '/Users/sam/Shots');
});

test('a custom prefix', () => {
  assert.strictEqual(parse(null, 'Capture', HOME).prefix, 'Capture');
});
