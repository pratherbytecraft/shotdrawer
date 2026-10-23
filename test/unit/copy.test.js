const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const copy = require('../../src/main/copy');

const PATHS = ['/Users/sam/Shots/Screenshot 2026-10-26 at 4.12.04 PM.png', "/Users/sam/Sam's shots/b.png"];

test('one per line by default', () => {
  assert.strictEqual(copy.join(PATHS, 'newline'), PATHS.join('\n'));
  assert.strictEqual(copy.join(PATHS, 'anything else'), PATHS.join('\n'));
});

test('space separated', () => {
  assert.strictEqual(copy.join(PATHS, 'space'), PATHS.join(' '));
});

test('shell quoted paths read back exactly in a shell, quote and all', () => {
  const line = copy.join(PATHS, 'quoted');
  assert.strictEqual(line, `'${PATHS[0]}' '/Users/sam/Sam'\\''s shots/b.png'`);
  const back = execFileSync('/bin/sh', ['-c', `for p in ${line}; do printf '%s\\n' "$p"; done`], { encoding: 'utf8' });
  assert.deepStrictEqual(back.trimEnd().split('\n'), PATHS);
});

test('a file URL escapes spaces and the narrow space', () => {
  assert.strictEqual(copy.fileUrl(PATHS[0]), 'file:///Users/sam/Shots/Screenshot%202026-10-26%20at%204.12.04%E2%80%AFPM.png');
});

test('the file name alone', () => {
  assert.strictEqual(copy.fileName(PATHS[1]), 'b.png');
});
