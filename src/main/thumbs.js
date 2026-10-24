// What a row shows about each screenshot: a Quick Look picture (the same
// one Finder draws), the picture's size in pixels and the file's size.
// Kept by path and change date, so a file edited in place gets a new one.
const { nativeImage } = require('electron');
const fsp = require('fs/promises');

// Big enough for a grid tile on a Retina screen.
const BOX = { width: 240, height: 150 };
const KEEP = 200; // pictures kept in memory

const cache = new Map();

// A PNG's width and height from its header, without reading the picture.
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function dimensions(file) {
  try {
    const fh = await fsp.open(file, 'r');
    const { buffer } = await fh.read(Buffer.alloc(24), 0, 24, 0);
    await fh.close();
    const png = pngSize(buffer);
    if (png) return png;
  } catch {
    return null;
  }
  // Other picture types, read whole by macOS. A PDF has no pixel size.
  const size = nativeImage.createFromPath(file).getSize();
  return size.width ? size : null;
}

async function one(file) {
  let stat;
  try {
    stat = await fsp.stat(file);
  } catch {
    return null;
  }
  const key = `${file}:${stat.mtimeMs}`;
  if (cache.has(key)) return cache.get(key);
  let thumb = null;
  try {
    thumb = (await nativeImage.createThumbnailFromPath(file, BOX)).toDataURL();
  } catch {
    // no picture for this one, the row shows a plain box
  }
  const info = { thumb, size: await dimensions(file), bytes: stat.size, mtime: stat.mtimeMs };
  cache.set(key, info);
  if (cache.size > KEEP) cache.delete(cache.keys().next().value);
  return info;
}

// { path: info } for each path that's still there.
async function details(files) {
  const out = {};
  await Promise.all(files.map(async (file) => {
    const info = await one(file);
    if (info) out[file] = info;
  }));
  return out;
}

module.exports = { details, pngSize };
