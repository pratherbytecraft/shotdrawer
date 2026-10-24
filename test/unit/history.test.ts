import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as history from '../../src/main/history';

const shot = (name: string, at: number) => ({ path: `/s/${name}.png`, at });
const all = () => true;

const fresh = (extra: Partial<history.History> = {}): history.History => ({ clearedAt: null, removed: [], shots: [], ...extra });

test('the first look takes the newest, cut to the size', () => {
  const found = [shot('a', 1), shot('b', 3), shot('c', 2)];
  const { next, changed } = history.apply(fresh(), found, 2, all);
  assert.ok(changed);
  assert.deepStrictEqual(next.shots.map((s) => s.at), [3, 2]);
});

test('catches up on shots taken while closed', () => {
  const last = fresh({ shots: [shot('e', 5), shot('d', 4)] });
  const found = [shot('d', 4), shot('e', 5), shot('f', 6), shot('g', 7)];
  const { next } = history.apply(last, found, 20, all);
  assert.deepStrictEqual(next.shots.map((s) => s.at), [7, 6, 5, 4]);
});

test('a bigger size fills up from the folder', () => {
  const found = [shot('a', 1), shot('b', 2), shot('c', 3), shot('d', 4)];
  const small = history.apply(fresh(), found, 2, all).next;
  assert.deepStrictEqual(small.shots.map((s) => s.at), [4, 3]);
  const { next, changed } = history.apply(small, found, 20, all);
  assert.ok(changed);
  assert.deepStrictEqual(next.shots.map((s) => s.at), [4, 3, 2, 1]);
});

test('a screenshot taken out of the list stays out', () => {
  const last = fresh({ removed: ['/s/d.png'], shots: [shot('e', 5)] });
  const { next, changed } = history.apply(last, [shot('d', 4), shot('e', 5)], 20, all);
  assert.ok(!changed);
  assert.deepStrictEqual(next.shots.map((s) => s.at), [5]);
});

test('nothing from before a Clear History comes back, even with room', () => {
  const last = fresh({ clearedAt: 100 });
  const { next } = history.apply(last, [shot('a', 50), shot('b', 99), shot('c', 101)], 20, all);
  assert.deepStrictEqual(next.shots.map((s) => s.at), [101]);
});

test('files that are gone drop out', () => {
  const last = fresh({ shots: [shot('b', 2), shot('a', 1)] });
  const { next, changed } = history.apply(last, [], 20, (p) => p !== '/s/b.png');
  assert.ok(changed);
  assert.deepStrictEqual(next.shots.map((s) => s.at), [1]);
});

test('a smaller size cuts the oldest', () => {
  const last = fresh({ shots: [shot('c', 3), shot('b', 2), shot('a', 1)] });
  const { next, changed } = history.apply(last, [], 2, all);
  assert.ok(changed);
  assert.deepStrictEqual(next.shots.map((s) => s.at), [3, 2]);
});

test('nothing new is no change', () => {
  const last = fresh({ shots: [shot('b', 2), shot('a', 1)] });
  assert.ok(!history.apply(last, [shot('a', 1), shot('b', 2)], 20, all).changed);
});

const made: string[] = [];
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotdrawer-test-'));
  made.push(dir);
  return dir;
}
test.after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

test('found lists only screenshots, with when each was made', async () => {
  const dir = tempDir();
  const names = ['Screenshot 2026-10-26 at 4.12.04 PM.png', 'notes.txt', '.Screenshot hidden.png', 'Screen Shot old.jpg'];
  for (const n of names) fs.writeFileSync(path.join(dir, n), 'x');
  fs.mkdirSync(path.join(dir, 'Screenshot folder.png'));
  const res = await history.found(dir, 'Screenshot');
  assert.strictEqual(res.access, 'ok');
  assert.deepStrictEqual(res.shots.map((s) => path.basename(s.path)).sort(), [names[0], names[3]].sort());
  assert.ok(res.shots.every((s) => s.at > 0));
});

test('found says when the folder is missing', async () => {
  const res = await history.found(path.join(tempDir(), 'nope'), 'Screenshot');
  assert.deepStrictEqual(res, { access: 'missing', shots: [] });
});

test('scan keeps the list on disk, clear empties it and keeps it empty', async () => {
  const data = tempDir();
  const folder = tempDir();
  history.init(data);
  const a = path.join(folder, 'Screenshot a.png');
  fs.writeFileSync(a, 'x');
  assert.ok((await history.scan(folder, 'Screenshot', 20)).changed);
  assert.deepStrictEqual(history.list().map((s) => s.path), [a]);
  // A fresh start reads the same list back.
  history.init(data);
  assert.deepStrictEqual(history.list().map((s) => s.path), [a]);

  history.clear();
  assert.deepStrictEqual(history.list(), []);
  assert.ok(!(await history.scan(folder, 'Screenshot', 20)).changed);

  await new Promise((r) => setTimeout(r, 20));
  const b = path.join(folder, 'Screenshot b.png');
  fs.writeFileSync(b, 'x');
  await history.scan(folder, 'Screenshot', 20);
  assert.deepStrictEqual(history.list().map((s) => s.path), [b]);
});

test('a screenshot made in the same millisecond as Clear History stays out', async () => {
  history.init(tempDir());
  const folder = tempDir();
  const a = path.join(folder, 'Screenshot a.png');
  fs.writeFileSync(a, 'x');
  await history.scan(folder, 'Screenshot', 20);
  // The clear's own time comes out a fraction before the file's.
  history.clear(Math.floor(fs.statSync(a).birthtimeMs) - 1);
  assert.ok(!(await history.scan(folder, 'Screenshot', 20)).changed);
  assert.deepStrictEqual(history.list(), []);
});

test('a broken screenshots.json starts an empty list', () => {
  const data = tempDir();
  fs.writeFileSync(path.join(data, 'screenshots.json'), '{ not json');
  assert.deepStrictEqual(history.init(data), []);
  fs.writeFileSync(path.join(data, 'screenshots.json'), JSON.stringify({ clearedAt: 'x', removed: [4, '/b.png'], shots: [{ path: 3 }, { path: '/a.png', at: 1 }] }));
  assert.deepStrictEqual(history.init(data), [{ path: '/a.png', at: 1 }]);
});

test('a folder it can\'t read keeps the list as it was', async () => {
  const data = tempDir();
  const folder = tempDir();
  history.init(data);
  fs.writeFileSync(path.join(folder, 'Screenshot a.png'), 'x');
  await history.scan(folder, 'Screenshot', 20);
  fs.chmodSync(folder, 0o000);
  try {
    const res = await history.scan(folder, 'Screenshot', 20);
    assert.deepStrictEqual(res, { changed: false, access: 'denied' });
    assert.strictEqual(history.list().length, 1);
  } finally {
    fs.chmodSync(folder, 0o755);
  }
});

test('a screenshot taken out with remove stays out', async () => {
  const data = tempDir();
  const folder = tempDir();
  history.init(data);
  const a = path.join(folder, 'Screenshot a.png');
  fs.writeFileSync(a, 'x');
  await new Promise((r) => setTimeout(r, 20));
  const b = path.join(folder, 'Screenshot b.png');
  fs.writeFileSync(b, 'x');
  await history.scan(folder, 'Screenshot', 20);
  assert.strictEqual(history.remove(b), 1);
  assert.strictEqual(history.remove(b), 0);
  await history.scan(folder, 'Screenshot', 20);
  assert.deepStrictEqual(history.list().map((s) => s.path), [a]);
});

test('a renamed screenshot keeps its spot under the new name', () => {
  const last = fresh({ shots: [shot('b', 2), shot('a', 1)] });
  const renamed = new Map([['/s/a.png', '/s/bug report.png']]);
  const { next, changed } = history.apply(last, [], 20, (p) => p !== '/s/a.png', renamed);
  assert.ok(changed);
  assert.deepStrictEqual(next.shots.map((s) => s.path), ['/s/b.png', '/s/bug report.png']);
});

test('scan follows a screenshot renamed in its folder, to any name', async () => {
  const data = tempDir();
  const folder = tempDir();
  history.init(data);
  const a = path.join(folder, 'Screenshot a.png');
  fs.writeFileSync(a, 'x');
  fs.writeFileSync(path.join(folder, 'holiday.png'), 'x');
  await history.scan(folder, 'Screenshot', 20);
  const renamed = path.join(folder, 'bug report.png');
  fs.renameSync(a, renamed);
  assert.ok((await history.scan(folder, 'Screenshot', 20)).changed);
  assert.deepStrictEqual(history.list().map((s) => s.path), [renamed]);
  // Gone for real, it drops out.
  fs.rmSync(renamed);
  await history.scan(folder, 'Screenshot', 20);
  assert.deepStrictEqual(history.list(), []);
});

test('Undo lets a removed screenshot back into the list', async () => {
  const data = tempDir();
  const folder = tempDir();
  history.init(data);
  const a = path.join(folder, 'Screenshot a.png');
  fs.writeFileSync(a, 'x');
  await history.scan(folder, 'Screenshot', 20);
  history.remove([a]);
  await history.scan(folder, 'Screenshot', 20);
  assert.deepStrictEqual(history.list(), []);
  history.unremove([a]);
  await history.scan(folder, 'Screenshot', 20);
  assert.deepStrictEqual(history.list().map((s) => s.path), [a]);
});
