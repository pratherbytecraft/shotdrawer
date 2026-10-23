// The list of recent screenshots, newest first, kept in
// ~/Library/Application Support/Shotdrawer/screenshots.json as
// { seenUpTo, shots: [{ path, at }] }. `at` is when the file was made, in ms.
//
// seenUpTo is the newest screenshot ever taken in, or the last Clear
// History when that's later. Only files made after it join the list, so a
// screenshot cleared or taken out of the list doesn't come back on the next
// rescan, and shots taken while Shotdrawer was closed are caught up on.
// Before the first screenshot it's null and the folder's newest join.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { isScreenshot, EXTENSIONS } = require('./detector');

let file = null;
let data = { seenUpTo: null, shots: [] };

function clean(saved) {
  const out = { seenUpTo: null, shots: [] };
  if (!saved || typeof saved !== 'object') return out;
  if (Number.isFinite(saved.seenUpTo)) out.seenUpTo = saved.seenUpTo;
  if (Array.isArray(saved.shots)) {
    out.shots = saved.shots.filter((s) => s && typeof s.path === 'string' && Number.isFinite(s.at)).map((s) => ({ path: s.path, at: s.at }));
  }
  return out;
}

function init(dir) {
  fs.mkdirSync(dir, { recursive: true });
  file = path.join(dir, 'screenshots.json');
  try {
    data = clean(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    data = clean(null);
  }
  return list();
}

function save() {
  if (file) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function list() {
  return data.shots.map((s) => ({ ...s }));
}

// The next list from the last one and the screenshots in the folder
// (found, [{ path, at }]): screenshots renamed in place (renamed, old path
// to new) keep their spot under the new name, files that are gone drop out,
// files newer than seenUpTo join, newest first, cut to limit. Doesn't touch
// the disk.
function apply(last, found, limit, exists, renamed = new Map()) {
  const kept = last.shots.map((s) => (renamed.has(s.path) ? { ...s, path: renamed.get(s.path) } : s)).filter((s) => exists(s.path));
  const known = new Set(kept.map((s) => s.path));
  const fresh = found.filter((f) => !known.has(f.path) && (last.seenUpTo === null || f.at > last.seenUpTo));
  const shots = [...kept, ...fresh].sort((a, b) => b.at - a.at).slice(0, limit);
  const seenUpTo = fresh.reduce((m, f) => (m === null || f.at > m ? f.at : m), last.seenUpTo);
  const changed = shots.length !== last.shots.length || shots.some((s, i) => s.path !== last.shots[i].path) || seenUpTo !== last.seenUpTo;
  return { next: { seenUpTo, shots }, changed };
}

// The screenshots in a folder as [{ path, at }], and whether the folder
// could be read: ok, missing, or denied (macOS hasn't given access to a
// folder in Documents or on the Desktop). The first read of such a folder
// waits on macOS's prompt, so it runs off the main thread.
async function found(folder, prefix) {
  let names;
  try {
    names = await fsp.readdir(folder, { withFileTypes: true });
  } catch (err) {
    return { access: err.code === 'ENOENT' || err.code === 'ENOTDIR' ? 'missing' : 'denied', shots: [] };
  }
  const picked = names.filter((entry) => entry.isFile() && isScreenshot(entry.name, prefix)).map((entry) => path.join(folder, entry.name));
  const stats = await Promise.all(picked.map((full) => fsp.stat(full).catch(() => null)));
  // A file gone between the listing and the look has no stat.
  const shots = picked.map((full, i) => stats[i] && { path: full, at: stats[i].birthtimeMs }).filter(Boolean);
  return { access: 'ok', shots };
}

// Screenshots from the list that are gone from the folder, found again under
// a new name. Renaming keeps when a file was made, so a picture in the folder
// made at the same moment is the same screenshot renamed (often to a name
// that doesn't start with Screenshot any more). Old path to new.
async function renames(folder, missing) {
  const out = new Map();
  let names;
  try {
    names = await fsp.readdir(folder, { withFileTypes: true });
  } catch {
    return out;
  }
  const pictures = names.filter((e) => e.isFile() && !e.name.startsWith('.') && EXTENSIONS.has(path.extname(e.name).toLowerCase()));
  const byAt = new Map();
  await Promise.all(pictures.map(async (e) => {
    const full = path.join(folder, e.name);
    try {
      byAt.set((await fsp.stat(full)).birthtimeMs, full);
    } catch {
      // gone between the listing and the look
    }
  }));
  for (const s of missing) if (byAt.has(s.at)) out.set(s.path, byAt.get(s.at));
  return out;
}

// Looks at the folder and brings the list up to date. Returns whether the
// list changed and whether the folder could be read.
async function scan(folder, prefix, limit) {
  const seen = await found(folder, prefix);
  // Without access every file in the folder looks gone; keep the list.
  if (seen.access === 'denied') return { changed: false, access: seen.access };
  const missing = data.shots.filter((s) => path.dirname(s.path) === folder && !fs.existsSync(s.path));
  const renamed = missing.length ? await renames(folder, missing) : new Map();
  const { next, changed } = apply(data, seen.shots, limit, fs.existsSync, renamed);
  if (changed) {
    data = next;
    save();
  }
  return { changed, access: seen.access };
}

// Takes one screenshot out of the list. seenUpTo stays, so it doesn't come
// back on the next rescan.
function remove(file) {
  const shots = data.shots.filter((s) => s.path !== file);
  if (shots.length === data.shots.length) return false;
  data = { ...data, shots };
  save();
  return true;
}

function clear(now = Date.now()) {
  data = { seenUpTo: Math.max(data.seenUpTo ?? 0, now), shots: [] };
  save();
}

module.exports = { init, list, apply, found, renames, scan, remove, clear };
