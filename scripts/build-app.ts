// Builds Shotdrawer.app at install time from Electron's own app bundle.
//
// Why: macOS asks for access to Documents, Desktop and Downloads in the
// name of the app bundle, so without this the asks would say Electron. A
// real app bundle also gives Shotdrawer its own name and icon in its
// prompts and in the login items, and lets Spotlight find it.
//
// The bundle goes to ~/Applications/Shotdrawer.app. It is an APFS clone of
// Electron.app, so it takes no extra disk space. Spotlight does not index
// symlinks, which is why it is a copy and not a link. If ~/Applications can't
// be used, the bundle is built inside the package instead.
//
// The bundle holds no Shotdrawer code and no version number, only a stamp of
// what it was built from (see bundleStamp).
// Contents/Resources/app is a two file stub that loads dist/main from the
// installed package, so an update to the package is picked up as is.
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const BUNDLE_ID = 'com.pratherbytecraft.shotdrawer';

// Homebrew keeps each version in its own Cellar folder and links the current
// one at opt/shotdrawer. The bundle points at the opt path, so it stays the
// same across brew upgrades and macOS keeps the folder access it was given.
function stableRoot(dir: string) {
  const m = dir.match(/^(.*)\/Cellar\/shotdrawer\/[^/]+\/(.*)$/);
  if (!m) return dir;
  const opt = `${m[1]}/opt/shotdrawer/${m[2]}`;
  return fs.existsSync(opt) ? opt : dir;
}

// Built into dist/scripts, two folders down from the package.
const root = stableRoot(path.join(__dirname, '..', '..'));
const mainScript = path.join(root, 'dist', 'main', 'index.js');

const userBundle = path.join(os.homedir(), 'Applications', 'Shotdrawer.app');
const localBundle = path.join(root, 'bundle', 'Shotdrawer.app');

function run(cmd: string, args: string[]) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${(res.stderr || res.stdout).trim()}`);
  return res.stdout;
}

function plistValue(bundle: string, key: string) {
  const res = spawnSync('plutil', ['-extract', key, 'raw', '-o', '-', path.join(bundle, 'Contents', 'Info.plist')], {
    encoding: 'utf8'
  });
  return res.status === 0 ? res.stdout.trim() : null;
}

// What goes into the bundle besides the stub: the icon, this script and
// Electron. When one of them changes the bundle is built again, which a
// Homebrew upgrade would otherwise skip (the bundle's path stays the same).
function bundleStamp() {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(path.join(root, 'assets', 'Shotdrawer.icns')));
  hash.update(fs.readFileSync(__filename));
  try {
    hash.update(require('electron/package.json').version);
  } catch {
    // no Electron yet, the build fixes that first
  }
  return hash.digest('hex').slice(0, 16);
}

// The stub a built bundle carries, or null when it isn't one of ours.
function bundleStub(bundle: string) {
  try {
    if (plistValue(bundle, 'CFBundleIdentifier') !== BUNDLE_ID) return null;
    return JSON.parse(fs.readFileSync(path.join(bundle, 'Contents', 'Resources', 'app', 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

// The Shotdrawer.app built for this package, or null when there isn't one or
// it was built from an older icon, script or Electron.
export function appPath() {
  for (const bundle of [userBundle, localBundle]) {
    const stub = bundleStub(bundle);
    if (stub && stub.shotdrawerPackage === root && stub.bundleStamp === bundleStamp()) return bundle;
  }
  return null;
}

function electronApp() {
  // require('electron') from Node gives the path to Electron.app/Contents/MacOS/Electron.
  const binary: string = require('electron');
  return path.resolve(binary, '..', '..', '..');
}

function pickDest() {
  // Never replace a Shotdrawer.app that isn't ours.
  if (fs.existsSync(userBundle) && plistValue(userBundle, 'CFBundleIdentifier') !== BUNDLE_ID) return localBundle;
  try {
    fs.mkdirSync(path.dirname(userBundle), { recursive: true });
    fs.accessSync(path.dirname(userBundle), fs.constants.W_OK);
    return userBundle;
  } catch {
    return localBundle;
  }
}

function writeStub(dest: string) {
  const stubDir = path.join(dest, 'Contents', 'Resources', 'app');
  fs.mkdirSync(stubDir, { recursive: true });
  const stubPkg = {
    name: 'shotdrawer',
    productName: 'Shotdrawer',
    private: true,
    main: 'index.js',
    shotdrawerPackage: root,
    bundleStamp: bundleStamp()
  };
  fs.writeFileSync(path.join(stubDir, 'package.json'), JSON.stringify(stubPkg, null, 2) + '\n');
  fs.writeFileSync(
    path.join(stubDir, 'index.js'),
    `// Written by shotdrawer/scripts/build-app.ts. Loads Shotdrawer from the installed package.
const fs = require('fs');
const target = ${JSON.stringify(mainScript)};
if (fs.existsSync(target)) {
  require(target);
} else {
  const { app, dialog } = require('electron');
  app.whenReady().then(() => {
    dialog.showMessageBoxSync({
      type: 'info',
      message: 'Shotdrawer is not installed anymore.',
      detail: 'Run npm install -g shotdrawer in Terminal to install it again, or move this app to the Trash.'
    });
    app.quit();
  });
}
`
  );
}

function setPlist(dest: string) {
  const plist = path.join(dest, 'Contents', 'Info.plist');
  const set = (key: string, type: string, value: string | boolean) => run('plutil', ['-replace', key, `-${type}`, String(value), plist]);
  set('CFBundleName', 'string', 'Shotdrawer');
  set('CFBundleDisplayName', 'string', 'Shotdrawer');
  set('CFBundleIdentifier', 'string', BUNDLE_ID);
  set('CFBundleIconFile', 'string', 'Shotdrawer.icns');
  set('LSApplicationCategoryType', 'string', 'public.app-category.utilities');
  set('NSHumanReadableCopyright', 'string', 'Prather Bytecraft. All rights reserved.');
  // A menu bar app: no Dock icon and no app menu.
  set('LSUIElement', 'bool', 'true');
  // The shotdrawer:// link other apps open to show the list (src/main/link.js).
  set('CFBundleURLTypes', 'json', JSON.stringify([{ CFBundleURLName: 'Shotdrawer link', CFBundleURLSchemes: ['shotdrawer'] }]));
  // Electron asks for these usage strings by default and Shotdrawer uses
  // none of them. The version keys go too: the bundle stays the same from one
  // Shotdrawer version to the next, so macOS keeps the folder access it gave
  // across updates. Shotdrawer reads its version from the package instead.
  for (const key of ['CFBundleShortVersionString', 'CFBundleVersion', 'NSCameraUsageDescription', 'NSMicrophoneUsageDescription',
    'NSBluetoothAlwaysUsageDescription', 'NSBluetoothPeripheralUsageDescription']) {
    spawnSync('plutil', ['-remove', key, plist]);
  }
}

export function build({ quiet = false } = {}) {
  if (process.platform !== 'darwin') return null;
  const log = (msg: string) => quiet || console.log(msg);
  let dest = pickDest();
  try {
    const src = electronApp();
    if (!fs.existsSync(src)) throw new Error(`Electron.app was not found at ${src}`);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    // -c clones on APFS. Other file systems get a plain copy.
    if (spawnSync('cp', ['-cR', src, dest]).status !== 0) run('cp', ['-R', src, dest]);
    fs.copyFileSync(path.join(root, 'assets', 'Shotdrawer.icns'), path.join(dest, 'Contents', 'Resources', 'Shotdrawer.icns'));
    setPlist(dest);
    writeStub(dest);
    run('codesign', ['--force', '--deep', '--sign', '-', dest]);
    // macOS ties Accessibility and the other permissions to an ad hoc app's
    // exact signature, so any change to the bundle (a new icon) would ask
    // again. Naming the bundle id instead keeps them across updates. Only the
    // outer bundle gets the rule; the Electron helpers inside keep their own.
    run('codesign', ['--force', '--sign', '-', `-r=designated => identifier "${BUNDLE_ID}"`, dest]);
    // Tell Spotlight and Launch Services about the new bundle right away.
    spawnSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', dest]);
    log(`Shotdrawer: app built at ${dest}`);
    return dest;
  } catch (err) {
    log(`Shotdrawer: the app bundle was not built, Shotdrawer will run as Electron.\n${(err as Error).message}`);
    return null;
  }
}

// Without Electron yet (see fix-electron.js), the first run builds the app.
if (require.main === module && !process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) build();
