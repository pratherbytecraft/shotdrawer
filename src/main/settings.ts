// Settings live in ~/Library/Application Support/Shotdrawer/settings.json.
// Missing keys fall back to the defaults, so a settings file from an older
// version keeps working after an update.
import fs from 'fs';
import path from 'path';
import type { Settings } from '../shared/types';

export const DEFAULTS: Readonly<Settings> = Object.freeze({
  historySize: 20, // how many screenshots the list keeps, 5 to 100 in steps of 5
  layout: 'list', // list | grid
  copyFormat: 'newline', // newline | space | quoted: how several paths are joined
  showIn: 'filedrawer', // filedrawer | finder: where Show in opens, when Filedrawer is installed
  menuBarIcon: 'auto', // auto (hidden while Startbar shows its Shotdrawer button) | always
  closeAfterCopy: false, // the list closes a moment after a copy
  bigLook: true // the big look opens when the pointer rests on a picture (Space always opens it)
});

const CHOICES: Partial<Record<keyof Settings, readonly string[]>> = {
  layout: ['list', 'grid'],
  copyFormat: ['newline', 'space', 'quoted'],
  showIn: ['filedrawer', 'finder'],
  menuBarIcon: ['auto', 'always']
};

let file: string | null = null;
let current: Settings = { ...DEFAULTS };
let fresh = false; // no settings file before this launch
const listeners = new Set<(settings: Settings) => void>();

// Only the keys Shotdrawer knows, each with a value it can use. Anything
// else, from a hand-edited file say, falls back to the default.
export function clean(saved: unknown): Partial<Settings> {
  const out: Record<string, unknown> = {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = (saved as Record<string, unknown>)[key];
    if (typeof v !== typeof DEFAULTS[key]) continue;
    const choices = CHOICES[key];
    if (choices && !choices.includes(v as string)) continue;
    if (key === 'historySize') {
      if (!Number.isFinite(v)) continue;
      out[key] = Math.min(100, Math.max(5, Math.round((v as number) / 5) * 5));
      continue;
    }
    out[key] = v;
  }
  return out;
}

export function init(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  file = path.join(dir, 'settings.json');
  fresh = !fs.existsSync(file);
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    saved = {};
  }
  current = { ...DEFAULTS, ...clean(saved) };
  // Written now, so only the very first launch counts as the first.
  if (fresh) save();
  return current;
}

export function get() {
  return current;
}

function save() {
  if (file) fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n');
}

export function update(patch: unknown) {
  current = { ...current, ...clean(patch) };
  save();
  for (const fn of listeners) fn(current);
  return current;
}

export function onChange(fn: (settings: Settings) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const firstRun = () => fresh;
