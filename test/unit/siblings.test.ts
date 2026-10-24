import test from 'node:test';
import assert from 'node:assert';
import { installLine } from '../../src/main/siblings';

test('the install line matches how this copy was installed', () => {
  assert.strictEqual(installLine('startbar', true), 'brew install pratherbytecraft/tap/startbar');
  assert.strictEqual(installLine('filedrawer', false), 'npm install -g filedrawer');
});
