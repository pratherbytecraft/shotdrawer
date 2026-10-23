// The list that opens under the menu bar icon, or above a spot another app
// names (Startbar's tray button): a frameless panel with the Mac's menu blur
// behind it. It opens on the Space in front, full screen apps included, and
// closes when it loses focus or on Esc. The page tells it how tall it wants
// to be.
const { BrowserWindow, screen } = require('electron');
const path = require('path');

const WIDTH = 360;
const GAP = 5; // points between the menu bar (or the spot) and the list
const EDGE = 8; // keeps the list this far from the screen's sides

let win = null;
let height = 200;
let hiddenAt = 0;
let at = null; // where the list opened last, kept for when its height changes

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

// Centered on the spot and kept on its screen: under the menu bar icon (a
// rect), or with its bottom just above a spot with edge 'bottom' ({ x, y }
// from another app, the top of Startbar's tray button), or its top just
// below one with edge 'top'.
function place(spot) {
  const area = screen.getDisplayNearestPoint({ x: Math.round(spot.x), y: Math.round(spot.y) }).workArea;
  const mid = spot.width ? spot.x + spot.width / 2 : spot.x;
  const left = Math.min(Math.max(Math.round(mid - WIDTH / 2), area.x + EDGE), area.x + area.width - WIDTH - EDGE);
  if (spot.edge === 'bottom') {
    const tall = Math.min(height, spot.y - GAP - area.y - EDGE);
    win.setBounds({ x: left, y: spot.y - GAP - tall, width: WIDTH, height: tall });
    return;
  }
  const top = Math.max(spot.y + (spot.height || 0), area.y) + GAP;
  const tall = Math.min(height, area.y + area.height - top - EDGE);
  win.setBounds({ x: left, y: top, width: WIDTH, height: tall });
}

function show(spot) {
  if (!win) create();
  if (spot) at = spot;
  if (at) place(at);
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
// hide counts as the closing click rather than opening it again. A link
// from another app takes longer to arrive, so it gets a longer grace.
// Returns whether the list opened.
function toggle(spot, grace = 250) {
  if (win && win.isVisible()) hide();
  else if (Date.now() - hiddenAt > grace) {
    show(spot);
    return true;
  }
  return false;
}

function setHeight(h) {
  height = Math.ceil(h);
  if (win && win.isVisible() && at) place(at);
}

function send(channel, payload) {
  if (win) win.webContents.send(channel, payload);
}

module.exports = { create, show, hide, toggle, setHeight, send, window: () => win };
