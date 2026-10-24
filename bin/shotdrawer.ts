#!/usr/bin/env node
// Launches Shotdrawer and returns at once. Run while Shotdrawer is open, it
// opens the list under the menu bar icon. `shotdrawer --foreground` keeps it
// attached to the terminal so its log shows.
//
// Shotdrawer.app is opened through Launch Services (`open`), not run
// directly, so macOS treats it as its own app and asks for folder access in
// its name.
import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { appPath, build, BUNDLE_ID } from '../scripts/build-app';
import { fix } from '../scripts/fix-electron';

if (process.platform !== 'darwin') {
  console.error('Shotdrawer runs on macOS only.');
  process.exit(1);
}

const foreground = process.argv.slice(2).includes('--foreground');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

function terminalPath() {
  if (!process.stdin.isTTY) return null;
  const res = spawnSync('tty', { stdio: ['inherit', 'pipe', 'ignore'], encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : null;
}

// Fallback when the bundle wasn't built: plain Electron, shown as Electron.
function runElectron() {
  // The path to the Electron binary when required from Node. Required here,
  // not imported, since it throws while Electron's install is unfinished.
  const electron: string = require('electron');
  const child = spawn(electron, [path.join(__dirname, '..', '..')], {
    detached: !foreground,
    stdio: foreground ? 'inherit' : 'ignore',
    env
  });
  if (foreground) {
    child.on('exit', (code) => process.exit(code ?? 0));
  } else {
    child.unref();
  }
}

function runBundle(bundle: string) {
  const openArgs = ['-a', bundle];
  const tty = foreground ? terminalPath() : null;
  if (tty) openArgs.unshift('-W', '--stdout', tty, '--stderr', tty);
  const child = spawn('open', openArgs, { stdio: 'inherit', env });
  if (tty) {
    // Control C quits Shotdrawer too, the way it did when it ran in this terminal.
    process.on('SIGINT', () => {
      spawnSync('osascript', ['-e', `tell application id "${BUNDLE_ID}" to quit`]);
    });
  }
  child.on('exit', (code) => process.exit(code ?? 0));
}

// The install builds Shotdrawer.app, except where it can't write to the home
// folder (Homebrew), or when the app belongs to an older install. Then the
// first run builds it, finishing Electron's install first if it stopped
// partway (see scripts/fix-electron.js).
(async () => {
  let bundle = appPath();
  if (!bundle) {
    console.log('Shotdrawer: setting up Shotdrawer.app, this takes a moment the first time.');
    await fix({ quiet: true });
    build({ quiet: true });
    bundle = appPath();
  }
  if (bundle) {
    runBundle(bundle);
  } else {
    if (foreground) console.log('Shotdrawer: Shotdrawer.app was not found, running as Electron. Run `npm run build-app` to build it.');
    runElectron();
  }
})();
