// Settings live in ~/Library/Application Support/Shotdrawer/settings.json.
// Missing keys fall back to the defaults, so a settings file from an older
// version keeps working after an update.
const fs = require('fs');
const path = require('path');

const DEFAULTS = Object.freeze({
  historySize: 20, // how many screenshots the list keeps, 5 to 100 in steps of 5
  layout: 'list', // list | grid
  copyFormat: 'newline', // newline | space | quoted: how several paths are joined
  showIn: 'filedrawer', // filedrawer | finder: where Show in opens, when Filedrawer is installed
  menuBarIcon: 'auto' // auto (hidden while Startbar shows its Shotdrawer button) | always
});

const CHOICES = {
  layout: ['list', 'grid'],
  copyFormat: ['newline', 'space', 'quoted'],
  showIn: ['filedrawer', 'finder'],
  menuBarIcon: ['auto', 'always']
};

let file = null;
let current = { ...DEFAULTS };
let fresh = false; // no settings file before this launch
const listeners = new Set();

// Only the keys Shotdrawer knows, each with a value it can use. Anything
// else, from a hand-edited file say, falls back to the default.
function clean(saved) {
  const out = {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
  for (const key of Object.keys(DEFAULTS)) {
    const v = saved[key];
    if (typeof v !== typeof DEFAULTS[key]) continue;
    if (CHOICES[key] && !CHOICES[key].includes(v)) continue;
    if (key === 'historySize') {
      if (!Number.isFinite(v)) continue;
      out[key] = Math.min(100, Math.max(5, Math.round(v / 5) * 5));
      continue;
    }
    out[key] = v;
  }
  return out;
}

function init(dir) {
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

function get() {
  return current;
}

function save() {
  fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n');
}

function update(patch) {
  current = { ...current, ...clean(patch) };
  save();
  for (const fn of listeners) fn(current);
  return current;
}

function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

module.exports = { DEFAULTS, init, get, update, onChange, clean, firstRun: () => fresh };
