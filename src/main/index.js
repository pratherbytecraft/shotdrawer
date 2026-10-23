// Shotdrawer main process. Owns the menu bar icon, the list and everything
// that touches the disk. Renderers only draw.
const { app, ipcMain, clipboard, dialog, shell, Menu } = require('electron');
const path = require('path');
const tray = require('./tray');
const panel = require('./panel');
const location = require('./location');
const history = require('./history');
const watcher = require('./watcher');
const settings = require('./settings');
const thumbs = require('./thumbs');

// From the package, not app.getVersion(): Shotdrawer.app carries no version
// so it stays the same across updates (see scripts/build-app.js).
const PKG = require('../../package.json');
const VERSION = PKG.version;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.setName('Shotdrawer');

let where = { folder: null, prefix: 'Screenshot' };
let access = null; // ok | missing | denied once the screenshot folder was looked at

function state() {
  return { version: VERSION, folder: where.folder, access, shots: history.list(), settings: settings.get() };
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
    if (res.changed || access !== was) panel.send('state', state());
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
    panel.send('state', state());
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
  panel.send('state', state());
});
ipcMain.on('folder:menu', () => {
  Menu.buildFromTemplate([
    { label: 'Show in Finder', click: () => shell.openPath(where.folder) },
    { label: 'Change Folder…', click: changeFolder }
  ]).popup({ window: panel.window() });
});
ipcMain.on('privacy:open', () => {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders');
  panel.hide();
});

// Picks a new folder for the screenshot tool to save to. The list closes
// while the folder picker is up, it would close anyway once the picker
// takes focus.
async function changeFolder() {
  panel.hide();
  app.focus({ steal: true });
  const res = await dialog.showOpenDialog({
    title: 'Save Screenshots To',
    buttonLabel: 'Choose',
    defaultPath: where.folder,
    properties: ['openDirectory', 'createDirectory']
  });
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
  settings.onChange(() => {
    rescan();
    panel.send('state', state());
  });
  tray.create({
    toggle: () => panel.toggle(tray.bounds()) && opened(),
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
