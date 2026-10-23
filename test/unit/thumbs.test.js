const test = require('node:test');
const assert = require('node:assert');
const { pngSize } = require('../../src/main/thumbs');

function header(width, height) {
  const buf = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

test('reads a PNG\'s size from its header', () => {
  assert.deepStrictEqual(pngSize(header(2880, 1800)), { width: 2880, height: 1800 });
});

test('nothing for other files or a short read', () => {
  assert.strictEqual(pngSize(Buffer.from('%PDF-1.7 and some more bytes')), null);
  assert.strictEqual(pngSize(header(10, 10).subarray(0, 20)), null);
});
