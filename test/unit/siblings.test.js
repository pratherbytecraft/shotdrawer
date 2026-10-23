const test = require('node:test');
const assert = require('node:assert');
const { installLine } = require('../../src/main/siblings');

test('the install line matches how this copy was installed', () => {
  assert.strictEqual(installLine('startbar', true), 'brew install pratherbytecraft/tap/startbar');
  assert.strictEqual(installLine('filedrawer', false), 'npm install -g filedrawer');
});
