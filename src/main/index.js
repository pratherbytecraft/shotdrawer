// Shotdrawer main process. Owns the menu bar icon, the list and everything
// that touches the disk. Renderers only draw.
const { app, ipcMain } = require('electron');
const tray = require('./tray');
const panel = require('./panel');

// From the package, not app.getVersion(): Shotdrawer.app carries no version
// so it stays the same across updates (see scripts/build-app.js).
const PKG = require('../../package.json');
const VERSION = PKG.version;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.setName('Shotdrawer');

function state() {
  return { version: VERSION };
}

ipcMain.handle('state', () => state());
ipcMain.on('panel:height', (_e, h) => panel.setHeight(h, tray.bounds()));
ipcMain.on('panel:hide', () => panel.hide());
ipcMain.on('app:quit', () => app.quit());

app.whenReady().then(() => {
  // Shotdrawer.app has no Dock icon (LSUIElement). Run as plain Electron it
  // would get one, so it's hidden here too.
  if (app.dock) app.dock.hide();
  tray.create({
    toggle: () => panel.toggle(tray.bounds()),
    quit: () => app.quit()
  });
  panel.create();
});

// Opening Shotdrawer again (the shotdrawer command, or the app in Finder)
// while it runs opens the list.
app.on('second-instance', () => panel.show(tray.bounds()));
app.on('activate', () => panel.show(tray.bounds()));

// The list is only hidden when it closes, never closed, so this only runs
// on Quit; Shotdrawer stays in the menu bar with no windows open.
app.on('window-all-closed', () => {});
