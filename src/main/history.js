// The list of recent screenshots, newest first, kept in
// ~/Library/Application Support/Shotdrawer/screenshots.json as
// { clearedAt, removed: [path], shots: [{ path, at }] }. `at` is when the
// file was made, in ms.
//
// The list is the newest screenshots in the folder, as many as the history
// size, leaving out what came before the last Clear History (clearedAt) and
// what was taken out by hand (removed). So shots taken while Shotdrawer was
// closed are caught up on, and a bigger history size fills up from the
// folder. Screenshots from a folder used before stay while they fit.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { isScreenshot, EXTENSIONS } = require('./detector');

let file = null;
let data = { clearedAt: null, removed: [], shots: [] };

const REMOVED_KEPT = 500; // paths taken out by hand that are remembered

function clean(saved) {
  const out = { clearedAt: null, removed: [], shots: [] };
  if (!saved || typeof saved !== 'object') return out;
  if (Number.isFinite(saved.clearedAt)) out.clearedAt = saved.clearedAt;
  if (Array.isArray(saved.removed)) out.removed = saved.removed.filter((p) => typeof p === 'string').slice(-REMOVED_KEPT);
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
// and the folder's screenshots made after the last clear and not taken out
// fill it, newest first, cut to limit. Doesn't touch the disk.
function apply(last, found, limit, exists, renamed = new Map()) {
  const kept = last.shots.map((s) => (renamed.has(s.path) ? { ...s, path: renamed.get(s.path) } : s)).filter((s) => exists(s.path));
  const known = new Set(kept.map((s) => s.path));
  const removed = new Set(last.removed);
  const fresh = found.filter((f) => !known.has(f.path) && !removed.has(f.path) && (last.clearedAt === null || f.at > last.clearedAt));
  const shots = [...kept, ...fresh].sort((a, b) => b.at - a.at).slice(0, limit);
  const changed = shots.length !== last.shots.length || shots.some((s, i) => s.path !== last.shots[i].path);
  return { next: { ...last, shots }, changed };
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

// Takes screenshots out of the list and remembers them, so they don't come
// back on the next rescan. Returns how many were in the list.
function remove(files) {
  const out = new Set([].concat(files));
  const shots = data.shots.filter((s) => !out.has(s.path));
  const gone = data.shots.length - shots.length;
  if (!gone) return 0;
  const removed = [...data.removed.filter((p) => !out.has(p)), ...out].slice(-REMOVED_KEPT);
  data = { ...data, shots, removed };
  save();
  return gone;
}

// Lets screenshots taken out by remove back in, for Undo. They show again
// on the next look at the folder, if there's room.
function unremove(files) {
  const back = new Set([].concat(files));
  data = { ...data, removed: data.removed.filter((p) => !back.has(p)) };
  save();
}

// Empties the list. What was in the folder before now stays out; the
// clear time covers everything taken out by hand before it too.
function clear(now = Date.now()) {
  data = { clearedAt: Math.max(data.clearedAt ?? 0, now), removed: [], shots: [] };
  save();
}

module.exports = { init, list, apply, found, renames, scan, remove, unremove, clear };
