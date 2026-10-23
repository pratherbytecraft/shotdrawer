// The settings window, and what its pages need from the Mac: open at login.
const { app, BrowserWindow } = require('electron');
const path = require('path');

let win = null;

function loginItem() {
  try {
    const { status } = app.getLoginItemSettings({ type: 'mainAppService' });
    return { on: status === 'enabled' || status === 'requires-approval', needsApproval: status === 'requires-approval' };
  } catch {
    return { on: false, needsApproval: false };
  }
}

function setLoginItem(on) {
  try {
    app.setLoginItemSettings({ openAtLogin: !!on, type: 'mainAppService' });
  } catch (err) {
    console.log(`Shotdrawer: the login item couldn't be changed: ${err.message}`);
  }
}

// Shotdrawer has no Dock icon, so the window is pulled in front of the app
// that's in use.
function show(page) {
  if (win && !win.isDestroyed()) {
    if (page) win.webContents.send('settings:page', page);
  } else {
    win = new BrowserWindow({
      width: 760,
      height: 560,
      minWidth: 640,
      minHeight: 420,
      show: false,
      title: 'Shotdrawer Settings',
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 16, y: 16 },
      fullscreenable: false,
      webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    win.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'index.html'), page ? { query: { page } } : undefined);
    win.once('ready-to-show', () => {
      win.show();
      app.focus({ steal: true });
    });
    win.on('closed', () => {
      win = null;
    });
    return win;
  }
  win.show();
  app.focus({ steal: true });
  win.focus();
  return win;
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

module.exports = { show, send, loginItem, setLoginItem, get window() { return win; } };
