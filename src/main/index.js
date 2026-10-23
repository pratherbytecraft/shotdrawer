// Shotdrawer main process. Owns the menu bar icon, the list and everything
// that touches the disk. Renderers only draw.
const { app, ipcMain, clipboard, dialog, shell, Menu, nativeImage } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const tray = require('./tray');
const panel = require('./panel');
const location = require('./location');
const history = require('./history');
const watcher = require('./watcher');
const settings = require('./settings');
const thumbs = require('./thumbs');
const copy = require('./copy');
const siblings = require('./siblings');
const prefs = require('./prefs');
const updates = require('./updates');

// From the package, not app.getVersion(): Shotdrawer.app carries no version
// so it stays the same across updates (see scripts/build-app.js).
const PKG = require('../../package.json');
const VERSION = PKG.version;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.setName('Shotdrawer');

// The line that updates this copy, for the About page: Homebrew keeps what
// it installs in its Cellar folder, npm in a node_modules folder.
const UPDATE_COMMAND = /\/Cellar\/shotdrawer\//.test(fs.realpathSync(__dirname)) ? 'brew upgrade shotdrawer' : 'npm install -g shotdrawer';

const LINKS = {
  website: 'https://pratherbytecraft.com',
  github: PKG.homepage,
  community: 'https://www.reddit.com/r/pratherbytecraft/',
  kofi: 'https://ko-fi.com/prathercc'
};

let where = { folder: null, prefix: 'Screenshot' };
let access = null; // ok | missing | denied once the screenshot folder was looked at

// Filedrawer when it's installed and picked for Show in, else null for Finder.
function viewer() {
  return settings.get().showIn === 'filedrawer' ? siblings.appPath('filedrawer') : null;
}

function state() {
  return {
    version: VERSION,
    folder: where.folder,
    access,
    shots: history.list(),
    settings: settings.get(),
    viewer: viewer() ? 'Filedrawer' : 'Finder',
    filedrawer: !!siblings.appPath('filedrawer'),
    loginItem: prefs.loginItem(),
    update: updates.get(),
    updateCommand: UPDATE_COMMAND
  };
}

// The list and the settings window draw from the same state.
function broadcast() {
  const now = state();
  panel.send('state', now);
  prefs.send('state', now);
}

// One scan at a time; a call during a scan runs one more after it.
let scanning = false;
let again = false;

async function rescan() {
  if (!where.folder) return;
  if (scanning) {
    again = true;
    return;
  }
  scanning = true;
  do {
    again = false;
    const was = access;
    const res = await history.scan(where.folder, where.prefix, settings.get().historySize);
    access = res.access;
    // The watcher starts once the folder can be read. One started before
    // macOS gave access to a folder in Documents or on the Desktop never
    // hears a thing. Files made while it starts are caught by one more scan.
    if (access === 'ok' && (was !== 'ok' || !watcher.active())) {
      watcher.start(where.folder, rescan);
      again = true;
    }
    if (res.changed || access !== was) broadcast();
  } while (again);
  scanning = false;
}

// Moves to the folder and prefix the screenshot tool uses now, and looks
// at the folder again (which starts the watcher if it isn't running, say
// for a folder that didn't exist yet).
function follow(next) {
  if (next.folder !== where.folder || next.prefix !== where.prefix) {
    where = next;
    watcher.stop();
    access = null;
    broadcast();
  }
  rescan();
}

ipcMain.handle('state', () => state());
ipcMain.on('panel:height', (_e, h) => panel.setHeight(h, tray.bounds()));
ipcMain.on('panel:hide', () => panel.hide());
ipcMain.on('app:quit', () => app.quit());
ipcMain.handle('shots:details', (_e, files) => thumbs.details(files));
ipcMain.on('shot:copy', (_e, file) => clipboard.writeText(file));
ipcMain.on('history:clear', () => {
  history.clear();
  broadcast();
});
ipcMain.on('shots:copy', (_e, files) => clipboard.writeText(copy.join(files, settings.get().copyFormat)));
ipcMain.on('shot:show', (_e, file) => showIn(file));
ipcMain.on('shot:menu', (_e, file, picked) => shotMenu(file, picked));
ipcMain.on('shots:drag', (e, files, picture) => {
  let icon = picture ? nativeImage.createFromDataURL(picture) : null;
  if (!icon || icon.isEmpty()) icon = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'Shotdrawer.icns'));
  e.sender.startDrag({ file: files[0], files, icon: icon.resize({ width: 64 }) });
});
ipcMain.on('folder:menu', () => {
  const folder = where.folder;
  Menu.buildFromTemplate([
    { label: `Show in ${state().viewer}`, click: () => showIn(folder, { folder: true }) },
    { label: 'Change Folder…', click: () => changeFolder() }
  ]).popup({ window: panel.window() });
});
ipcMain.on('settings:open', (_e, page) => {
  panel.hide();
  prefs.show(page);
});
ipcMain.on('settings:set', (_e, patch) => settings.update(patch));
ipcMain.on('login:set', (_e, on) => {
  prefs.setLoginItem(on);
  broadcast();
});
ipcMain.on('updates:check', () => updates.check(VERSION));
ipcMain.on('text:copy', (_e, text) => clipboard.writeText(String(text)));
ipcMain.on('link:open', (_e, key) => LINKS[key] && shell.openExternal(LINKS[key]));
ipcMain.on('folder:show', () => showIn(where.folder, { folder: true }));
ipcMain.on('folder:change', (e) => changeFolder(prefs.window && e.sender === prefs.window.webContents ? prefs.window : null));
ipcMain.on('privacy:open', () => {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders');
  panel.hide();
});

// Shows a screenshot picked in its folder, or a folder itself, in
// Filedrawer when it's picked and installed, else in Finder.
function showIn(file, { folder = false } = {}) {
  panel.hide();
  const fd = viewer();
  if (fd) execFile('open', ['-a', fd, file], (err) => err && (folder ? shell.openPath(file) : shell.showItemInFolder(file)));
  else if (folder) shell.openPath(file);
  else shell.showItemInFolder(file);
}

function copied(file, text) {
  clipboard.writeText(text);
  panel.send('copied', file);
}

// The right click menu on a screenshot. picked is the list of screenshots
// picked together when this one is among them.
function shotMenu(file, picked) {
  const items = [];
  if (picked.length > 1) {
    items.push({ label: `Copy ${picked.length} Paths`, click: () => copied(file, copy.join(picked, settings.get().copyFormat)) }, { type: 'separator' });
  }
  items.push(
    { label: 'Copy Path', click: () => copied(file, file) },
    { label: 'Copy as file:// URL', click: () => copied(file, copy.fileUrl(file)) },
    { label: 'Copy Filename', click: () => copied(file, copy.fileName(file)) },
    { type: 'separator' },
    { label: `Show in ${state().viewer}`, click: () => showIn(file) },
    { label: 'Open', click: () => { panel.hide(); shell.openPath(file); } },
    { type: 'separator' },
    { label: 'Remove from History', click: () => history.remove(file) && panel.send('state', state()) },
    { label: 'Move to Trash', click: () => shell.trashItem(file).catch((err) => console.log(`Shotdrawer: ${file} wasn't moved to the Trash: ${err.message}`)).then(rescan) }
  );
  Menu.buildFromTemplate(items).popup({ window: panel.window() });
}

// Picks a new folder for the screenshot tool to save to, as a sheet on the
// settings window or on its own from the list. The list closes while the
// folder picker is up, it would close anyway once the picker takes focus.
async function changeFolder(parent) {
  panel.hide();
  app.focus({ steal: true });
  const options = {
    title: 'Save Screenshots To',
    buttonLabel: 'Choose',
    defaultPath: where.folder,
    properties: ['openDirectory', 'createDirectory']
  };
  const res = await (parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options));
  if (res.canceled || !res.filePaths.length) return;
  try {
    await location.setFolder(res.filePaths[0]);
  } catch (err) {
    console.log(`Shotdrawer: the screenshot folder couldn't be changed: ${err.message}`);
  }
  follow(await location.read());
}

// Each time the list opens: a safety net for a folder change the settings
// file didn't report yet.
function opened() {
  location.read().then(follow);
}

function showList() {
  panel.show(tray.bounds());
  opened();
}

app.whenReady().then(async () => {
  // Shotdrawer.app has no Dock icon (LSUIElement). Run as plain Electron it
  // would get one, so it's hidden here too.
  if (app.dock) app.dock.hide();
  const data = path.join(app.getPath('appData'), 'Shotdrawer');
  settings.init(data);
  history.init(data);
  // Open at login is on from the first launch.
  if (settings.firstRun()) prefs.setLoginItem(true);
  settings.onChange(() => {
    rescan();
    broadcast();
  });
  updates.onChange(broadcast);
  updates.schedule(VERSION, () => true);
  // Shotdrawer's menu bar is never shown, but its keys still work in the
  // settings window: Cmd W closes it, Cmd Q quits, and the Edit keys work
  // in the search box.
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      role: 'appMenu',
      submenu: [
        { label: 'About Shotdrawer', click: () => prefs.show('about') },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'Cmd+,', click: () => prefs.show() },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'windowMenu' }
  ]));
  tray.create({
    toggle: () => panel.toggle(tray.bounds()) && opened(),
    settings: () => prefs.show(),
    quit: () => app.quit()
  });
  panel.create();
  follow(await location.read());
  location.watch(() => where, follow);
});

// Opening Shotdrawer again (the shotdrawer command, or the app in Finder)
// while it runs opens the list.
app.on('second-instance', showList);
app.on('activate', showList);

// The list is only hidden when it closes, never closed, so this only runs
// on Quit; Shotdrawer stays in the menu bar with no windows open.
app.on('window-all-closed', () => {});
