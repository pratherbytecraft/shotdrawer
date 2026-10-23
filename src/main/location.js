// Where macOS saves screenshots and what it names them, from the screenshot
// tool's own settings (com.apple.screencapture `location` and `name`). A
// change made in the screenshot tool (Options, Save to) is picked up from
// its settings file without a restart.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DOMAIN = 'com.apple.screencapture';
const PREFS = path.join(os.homedir(), 'Library', 'Preferences');

// The folder and prefix from the raw `defaults` values, null when unset.
function parse(location, name, home = os.homedir()) {
  let folder = (location || '').trim();
  if (folder === '~' || folder.startsWith('~/')) folder = path.join(home, folder.slice(1));
  folder = folder ? path.resolve(folder) : path.join(home, 'Desktop');
  const prefix = (name || '').trim() || 'Screenshot';
  return { folder, prefix };
}

function readDefault(key) {
  return new Promise((resolve) => {
    execFile('defaults', ['read', DOMAIN, key], { encoding: 'utf8' }, (err, out) => resolve(err ? null : out.replace(/\n$/, '')));
  });
}

async function read() {
  const [location, name] = await Promise.all([readDefault('location'), readDefault('name')]);
  return parse(location, name);
}

// Tells the screenshot tool to save to another folder, the same setting its
// Options menu changes.
function setFolder(folder) {
  return new Promise((resolve, reject) => {
    execFile('defaults', ['write', DOMAIN, 'location', folder], (err) => (err ? reject(err) : resolve()));
  });
}

// Calls onChange with the new { folder, prefix } when the screenshot tool's
// settings file changes and the folder or prefix differ from `current()`.
// The file is replaced, not edited, so its folder is watched.
function watch(current, onChange) {
  let timer = null;
  try {
    const watcher = fs.watch(PREFS, (_event, file) => {
      if (file !== `${DOMAIN}.plist`) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const next = await read();
        const now = current();
        if (next.folder !== now.folder || next.prefix !== now.prefix) onChange(next);
      }, 300);
    });
    watcher.on('error', () => {});
    return watcher;
  } catch {
    return null;
  }
}

module.exports = { parse, read, watch, setFolder };
