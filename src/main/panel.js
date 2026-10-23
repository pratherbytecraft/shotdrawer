// The list that opens under the menu bar icon: a frameless panel with the
// Mac's menu blur behind it. It opens on the Space in front, full screen
// apps included, and closes when it loses focus or on Esc. The page tells
// it how tall it wants to be.
const { BrowserWindow, screen } = require('electron');
const path = require('path');

const WIDTH = 360;
const GAP = 5; // points between the menu bar and the list
const EDGE = 8; // keeps the list this far from the screen's sides

let win = null;
let height = 200;
let hiddenAt = 0;

function create() {
  win = new BrowserWindow({
    width: WIDTH,
    height,
    // A panel opens over full screen apps and takes clicks and keys without
    // pulling another app's windows forward.
    type: 'panel',
    frame: false,
    transparent: true,
    hasShadow: true,
    roundedCorners: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    acceptFirstMouse: true,
    skipTaskbar: true,
    show: false,
    vibrancy: 'menu',
    visualEffectState: 'active',
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'panel', 'index.html'));
  win.on('blur', hide);
  win.on('closed', () => {
    win = null;
  });
  return win;
}

// Under the icon, centered on it, kept on the icon's screen.
function place(icon) {
  const area = screen.getDisplayNearestPoint({ x: icon.x, y: icon.y }).workArea;
  const x = Math.round(icon.x + icon.width / 2 - WIDTH / 2);
  const left = Math.min(Math.max(x, area.x + EDGE), area.x + area.width - WIDTH - EDGE);
  const top = Math.max(icon.y + icon.height, area.y) + GAP;
  const tall = Math.min(height, area.y + area.height - top - EDGE);
  win.setBounds({ x: left, y: top, width: WIDTH, height: tall });
}

function show(icon) {
  if (!win) create();
  if (icon) place(icon);
  win.show();
  win.focus();
  win.webContents.send('panel:shown');
}

function hide() {
  if (!win || !win.isVisible()) return;
  win.hide();
  hiddenAt = Date.now();
}

// A click on the icon while the list is open closes it. The list loses
// focus to that click first and hides itself, so a click right after a
// hide counts as the closing click rather than opening it again.
function toggle(icon) {
  if (win && win.isVisible()) hide();
  else if (Date.now() - hiddenAt > 250) show(icon);
}

function setHeight(h, icon) {
  height = Math.ceil(h);
  if (win && win.isVisible() && icon) place(icon);
}

module.exports = { create, show, hide, toggle, setHeight };
