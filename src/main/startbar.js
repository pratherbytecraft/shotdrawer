// Whether Startbar is showing its Shotdrawer button in the tray right now:
// Startbar is running, is a version that has the button (0.2.17 and up),
// and the button isn't switched off on its Clock and Tray page. While it
// is, Shotdrawer's menu bar icon can step aside. Looked at every few
// seconds, so the icon comes back soon after Startbar quits.
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const siblings = require('./siblings');
const { newer } = require('./updates');

const FIRST_WITH_BUTTON = '0.2.17';
const EVERY = 3000; // ms

// From Startbar's settings and package, read off the disk.
function decide({ running, version, settings }) {
  if (!running || !version || newer(FIRST_WITH_BUTTON, version)) return false;
  const tray = settings && settings.tray;
  return !(tray && tray.shotdrawer === false);
}

function running() {
  return new Promise((resolve) => {
    execFile('lsappinfo', ['find', `bundleid=${siblings.APPS.startbar.id}`], { encoding: 'utf8' }, (err, out) => resolve(!err && /ASN:/.test(out)));
  });
}

// The installed Startbar's version, from the package its app loads.
function version(app) {
  try {
    const stub = JSON.parse(fs.readFileSync(path.join(app, 'Contents', 'Resources', 'app', 'package.json'), 'utf8'));
    return JSON.parse(fs.readFileSync(path.join(stub.startbarPackage, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

function settings() {
  try {
    return JSON.parse(fs.readFileSync(path.join(os.homedir(), 'Library', 'Application Support', 'Startbar', 'settings.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function check() {
  const app = siblings.appPath('startbar');
  if (!app) return false;
  return decide({ running: await running(), version: version(app), settings: settings() });
}

// Calls onChange(showing) now and whenever it changes.
function watch(onChange) {
  let last = null;
  const tick = async () => {
    const now = await check();
    if (now !== last) {
      last = now;
      onChange(now);
    }
  };
  tick();
  setInterval(tick, EVERY);
}

module.exports = { decide, watch };
