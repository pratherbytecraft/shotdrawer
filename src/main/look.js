// The big look: a larger picture of one screenshot beside the list, from
// mockups/biglook.html. It opens when the pointer rests on a picture or on
// Space, never takes the focus or a click (clicks go through to what's
// under it), and goes away with the list.
const { BrowserWindow, nativeImage, screen } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const thumbs = require('./thumbs');

const MAX_WIDTH = 480; // points for the picture
const MAX_HEIGHT = 560;
const PAD = 8; // around the picture
const CAPTION = 34;
const HINT = 20; // the keys line, opened with Space
const GAP = 10; // between the list and the big look
const EDGE = 8; // from the screen's sides
const KEEP = 12; // pictures kept in memory

let win = null;
let ready = null;
let asked = 0; // each show counts up, so an older one finishing late is dropped
const cache = new Map(); // file:mtime -> { src, width, height }

function create() {
  win = new BrowserWindow({
    width: MAX_WIDTH + PAD * 2,
    height: 300,
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
    focusable: false,
    skipTaskbar: true,
    show: false,
    vibrancy: 'menu',
    visualEffectState: 'active',
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  });
  win.setIgnoreMouseEvents(true);
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  ready = new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  win.loadFile(path.join(__dirname, '..', 'renderer', 'look', 'index.html'));
  win.on('closed', () => {
    win = null;
  });
}

// Where the big look gets the picture. PNG and JPEG screenshots load
// straight from the file, which the page draws fast; HEIC, TIFF and PDF get
// Quick Look's picture, since the page can't draw those itself.
const DIRECT = new Set(['.png', '.jpg', '.jpeg']);
async function picture(file, info) {
  if (DIRECT.has(path.extname(file).toLowerCase()) && info.size) {
    return { src: pathToFileURL(file).href, width: info.size.width, height: info.size.height };
  }
  const key = `${file}:${info.mtime}`;
  if (cache.has(key)) return cache.get(key);
  let image;
  try {
    image = await nativeImage.createThumbnailFromPath(file, { width: MAX_WIDTH * 2, height: MAX_HEIGHT * 2 });
  } catch {
    return null;
  }
  const size = image.getSize();
  if (!size.width) return null;
  const out = { src: image.toDataURL(), width: size.width, height: size.height };
  cache.set(key, out);
  if (cache.size > KEEP) cache.delete(cache.keys().next().value);
  return out;
}

// The picture's size on screen: as wide as it fits, no taller than
// MAX_HEIGHT, never bigger than the screenshot itself at half size.
function fit(width, height) {
  let w = Math.min(MAX_WIDTH, Math.max(160, Math.round(width / 2)));
  let h = Math.round((w * height) / width);
  if (h > MAX_HEIGHT) {
    h = MAX_HEIGHT;
    w = Math.round((h * width) / height);
  }
  return { w, h };
}

// Opens or moves the big look for a file, lined up with a row of the list
// (row is in screen points). To the left of the list, or to its right when
// the list sits at the left of the screen.
async function show(file, row, list, withHint) {
  const mine = ++asked;
  if (!win) create();
  await ready;
  const [info] = Object.values(await thumbs.details([file]));
  if (mine !== asked) return;
  if (!info) return hide();
  const pic = await picture(file, info);
  if (mine !== asked) return;
  if (!pic) return hide();
  const { w, h } = fit(pic.width, pic.height);
  const width = w + PAD * 2;
  const height = PAD + h + CAPTION + (withHint ? HINT : 0);
  const area = screen.getDisplayNearestPoint({ x: Math.round(list.x), y: Math.round(row.y) }).workArea;
  let x = list.x - GAP - width;
  if (x < area.x + EDGE) x = list.x + list.width + GAP;
  const y = Math.min(Math.max(row.y - PAD, area.y + EDGE), area.y + area.height - height - EDGE);
  win.setBounds({ x: Math.round(x), y: Math.round(y), width, height });
  win.webContents.send('look:show', {
    src: pic.src,
    name: path.basename(file),
    size: info.size,
    bytes: info.bytes,
    hint: withHint
  });
  if (!win.isVisible()) win.showInactive();
}

function hide() {
  asked++;
  if (win && win.isVisible()) win.hide();
}

// Made ahead of time, so the first big look doesn't wait for its window.
function prepare() {
  if (!win) create();
}

module.exports = { show, hide, prepare };
