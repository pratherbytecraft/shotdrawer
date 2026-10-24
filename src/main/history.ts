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
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { isScreenshot, EXTENSIONS } from './detector';
import type { Access, Shot } from '../shared/types';

export interface History {
  clearedAt: number | null;
  removed: string[];
  shots: Shot[];
}

let file: string | null = null;
let data: History = { clearedAt: null, removed: [], shots: [] };

const REMOVED_KEPT = 500; // paths taken out by hand that are remembered

function clean(saved: unknown): History {
  const out: History = { clearedAt: null, removed: [], shots: [] };
  if (!saved || typeof saved !== 'object') return out;
  const s = saved as Record<string, unknown>;
  if (typeof s.clearedAt === 'number' && Number.isFinite(s.clearedAt)) out.clearedAt = s.clearedAt;
  if (Array.isArray(s.removed)) out.removed = s.removed.filter((p): p is string => typeof p === 'string').slice(-REMOVED_KEPT);
  if (Array.isArray(s.shots)) {
    out.shots = s.shots.filter((x) => x && typeof x.path === 'string' && Number.isFinite(x.at)).map((x) => ({ path: x.path, at: x.at }));
  }
  return out;
}

export function init(dir: string) {
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

export function list(): Shot[] {
  return data.shots.map((s) => ({ ...s }));
}

// The next list from the last one and the screenshots in the folder
// (found, [{ path, at }]): screenshots renamed in place (renamed, old path
// to new) keep their spot under the new name, files that are gone drop out,
// and the folder's screenshots made after the last clear and not taken out
// fill it, newest first, cut to limit. Doesn't touch the disk.
export function apply(last: History, found: Shot[], limit: number, exists: (p: string) => boolean, renamed = new Map<string, string>()) {
  const kept = last.shots.map((s) => (renamed.has(s.path) ? { ...s, path: renamed.get(s.path)! } : s)).filter((s) => exists(s.path));
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
export async function found(folder: string, prefix: string): Promise<{ access: Access; shots: Shot[] }> {
  let names;
  try {
    names = await fsp.readdir(folder, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return { access: code === 'ENOENT' || code === 'ENOTDIR' ? 'missing' : 'denied', shots: [] };
  }
  const picked = names.filter((entry) => entry.isFile() && isScreenshot(entry.name, prefix)).map((entry) => path.join(folder, entry.name));
  const stats = await Promise.all(picked.map((full) => fsp.stat(full).catch(() => null)));
  // A file gone between the listing and the look has no stat.
  const shots = picked.flatMap((full, i) => {
    const stat = stats[i];
    return stat ? [{ path: full, at: stat.birthtimeMs }] : [];
  });
  return { access: 'ok', shots };
}

// Screenshots from the list that are gone from the folder, found again under
// a new name. Renaming keeps when a file was made, so a picture in the folder
// made at the same moment is the same screenshot renamed (often to a name
// that doesn't start with Screenshot any more). Old path to new.
export async function renames(folder: string, missing: Shot[]) {
  const out = new Map<string, string>();
  let names;
  try {
    names = await fsp.readdir(folder, { withFileTypes: true });
  } catch {
    return out;
  }
  const pictures = names.filter((e) => e.isFile() && !e.name.startsWith('.') && EXTENSIONS.has(path.extname(e.name).toLowerCase()));
  const byAt = new Map<number, string>();
  await Promise.all(pictures.map(async (e) => {
    const full = path.join(folder, e.name);
    try {
      byAt.set((await fsp.stat(full)).birthtimeMs, full);
    } catch {
      // gone between the listing and the look
    }
  }));
  for (const s of missing) {
    const now = byAt.get(s.at);
    if (now) out.set(s.path, now);
  }
  return out;
}

// Looks at the folder and brings the list up to date. Returns whether the
// list changed and whether the folder could be read.
export async function scan(folder: string, prefix: string, limit: number) {
  const seen = await found(folder, prefix);
  // Without access every file in the folder looks gone; keep the list.
  if (seen.access === 'denied') return { changed: false, access: seen.access };
  const missing = data.shots.filter((s) => path.dirname(s.path) === folder && !fs.existsSync(s.path));
  const renamed = missing.length ? await renames(folder, missing) : new Map<string, string>();
  const { next, changed } = apply(data, seen.shots, limit, fs.existsSync, renamed);
  if (changed) {
    data = next;
    save();
  }
  return { changed, access: seen.access };
}

// Takes screenshots out of the list and remembers them, so they don't come
// back on the next rescan. Returns how many were in the list.
export function remove(files: string | string[]) {
  const out = new Set(([] as string[]).concat(files));
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
export function unremove(files: string | string[]) {
  const back = new Set(([] as string[]).concat(files));
  data = { ...data, removed: data.removed.filter((p) => !back.has(p)) };
  save();
}

// Empties the list. What was in the folder before now stays out; the
// clear time covers everything taken out by hand before it too.
export function clear(now = Date.now()) {
  data = { clearedAt: Math.max(data.clearedAt ?? 0, now), removed: [], shots: [] };
  save();
}
