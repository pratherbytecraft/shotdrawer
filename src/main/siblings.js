// Prather Bytecraft's other apps, when they're installed. Each is found by
// its bundle id in ~/Applications or /Applications, looked up now and then,
// not on every redraw.
const { execFileSync } = require('child_process');
const os = require('os');
const path = require('path');

const APPS = {
  filedrawer: { id: 'com.pratherbytecraft.filedrawer', name: 'Filedrawer.app' },
  startbar: { id: 'com.pratherbytecraft.startbar', name: 'Startbar.app' }
};
const FRESH = 30 * 1000;

const seen = {};

function appPath(key) {
  const app = APPS[key];
  if (seen[key] && Date.now() - seen[key].at < FRESH) return seen[key].path;
  let found = null;
  for (const dir of [path.join(os.homedir(), 'Applications'), '/Applications']) {
    const p = path.join(dir, app.name);
    try {
      const id = execFileSync('plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', path.join(p, 'Contents', 'Info.plist')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (id === app.id) {
        found = p;
        break;
      }
    } catch {
      // not there
    }
  }
  seen[key] = { at: Date.now(), path: found };
  return found;
}

module.exports = { appPath, APPS };
