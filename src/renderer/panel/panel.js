// The list under the menu bar icon: the recent screenshots, newest first,
// in rows or a grid, grouped by day. A click copies the screenshot's path;
// several can be picked and copied together, dragged out, or acted on from
// the right click menu.
const api = window.shotdrawer;
const panel = document.getElementById('panel');
const body = document.getElementById('body');
const tip = document.getElementById('tip');

const I = {
  viewfinder: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.8 5V2.5a.7.7 0 0 1 .7-.7H5M11 1.8h2.5a.7.7 0 0 1 .7.7V5M14.2 11v2.5a.7.7 0 0 1-.7.7H11M5 14.2H2.5a.7.7 0 0 1-.7-.7V11"/><path d="M4.5 11l2.5-3 1.8 2 1.2-1.2 1.5 2.2"/></svg>',
  folder: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M1.8 4.2c0-.7.5-1.2 1.2-1.2h3l1.5 1.6h5.5c.7 0 1.2.5 1.2 1.2v6.2c0 .7-.5 1.2-1.2 1.2H3c-.7 0-1.2-.5-1.2-1.2z"/></svg>',
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>',
  dots: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>',
  chev: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px"><path d="M4 6l4 4 4-4"/></svg>'
};

const COPIED_FOR = 1200; // ms
const TIP_AFTER = 600; // ms

let state = null;
const details = {}; // path -> { thumb, size, bytes }
let copied = null; // { path, until }
let confirming = false;
const picked = new Set(); // paths picked with Cmd click, Shift click or a sweep
let anchor = null; // the last path clicked with Cmd or Shift, where a Shift range starts
let pickedCopied = 0; // until when the selection bar says Copied

const FORMAT_LABEL = { newline: 'one per line', space: 'space separated', quoted: 'shell quoted' };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const baseName = (p) => p.slice(p.lastIndexOf('/') + 1);

function dayOf(at, now) {
  const d = new Date(at);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (d >= today) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return d >= yesterday ? 'Yesterday' : 'Earlier';
}

function timeOf(at, day) {
  const d = new Date(at);
  if (day === 'Earlier') return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function ago(at, now) {
  const min = Math.floor((now - at) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} hr ago`;
}

// Finder's way: 1000 bytes to a KB.
function bytesOf(n) {
  if (n < 1000) return `${n} bytes`;
  if (n < 1000 * 1000) return `${Math.round(n / 1000)} KB`;
  return `${(n / 1000 / 1000).toFixed(1)} MB`;
}

function sizeLine(info) {
  if (!info) return '';
  const parts = [];
  if (info.size) parts.push(`${info.size.width} × ${info.size.height}`);
  parts.push(bytesOf(info.bytes));
  return parts.join(' · ');
}

function thumb(shot) {
  const info = details[shot.path];
  return `<div class="th" draggable="true">${info && info.thumb ? `<img src="${info.thumb}" alt="">` : ''}</div>`;
}

function emptyState() {
  const name = esc(baseName(state.folder || ''));
  if (state.access === 'denied') {
    return `<div class="empty">${I.folder}<div class="big">Shotdrawer can't open ${name}</div>
      <div class="small">Turn on Shotdrawer for this folder in System Settings, under Privacy &amp; Security, Files &amp; Folders.</div>
      <button class="btn" id="privacy">Open System Settings</button></div>`;
  }
  if (state.access === 'missing') {
    return `<div class="empty">${I.folder}<div class="big">${name} isn't there anymore</div>
      <div class="small">macOS saves screenshots to a folder that was moved or deleted. Pick another one with the folder button below.</div></div>`;
  }
  return `<div class="empty">${I.viewfinder}<div class="big">No screenshots yet</div>
    <div class="small">Press <kbd>⇧⌘3</kbd> for the whole screen or <kbd>⇧⌘4</kbd> for part of it. New ones show up here right away.</div></div>`;
}

function render() {
  if (!state) return;
  const now = Date.now();
  const shots = state.shots;
  const grid = state.settings.layout === 'grid';
  const count = document.getElementById('count');
  count.hidden = shots.length === 0;
  count.textContent = shots.length;

  if (!shots.length || state.access === 'denied') {
    body.innerHTML = emptyState();
  } else {
    let lastDay = null;
    const items = shots.map((shot) => {
      const day = dayOf(shot.at, now);
      let out = '';
      if (day !== lastDay) {
        out += `<div class="day">${day}</div>`;
        lastDay = day;
      }
      const time = timeOf(shot.at, day);
      const isCopied = copied && copied.path === shot.path && copied.until > now;
      const mark = isCopied ? `<div class="copied">${I.check} Copied</div>` : '';
      const attrs = `data-path="${esc(shot.path)}"`;
      const on = picked.has(shot.path);
      const chk = picked.size ? `<div class="chk${on ? ' on' : ''}">${on ? I.check : ''}</div>` : '';
      const btns = `<button class="icon-btn" data-act="show" title="Show in ${state.viewer}">${I.folder}</button><button class="icon-btn" data-act="menu" title="More">${I.dots}</button>`;
      if (grid) {
        out += `<div class="tile${on ? ' sel' : ''}" ${attrs}>${thumb(shot)}${chk}<div class="over">${btns}</div>${mark}<div class="cap">${esc(time)}</div></div>`;
      } else {
        const when = day === 'Today' ? ` <span>· ${ago(shot.at, now)}</span>` : '';
        out += `<div class="row${on ? ' sel' : ''}" ${attrs}>${chk}${thumb(shot)}
          <div class="info"><div class="l1">${esc(time)}${when}</div><div class="l2">${esc(sizeLine(details[shot.path]))}</div></div>${mark || `<div class="acts">${btns}</div>`}</div>`;
      }
      return out;
    }).join('');
    const scroll = body.querySelector('.list') ? body.querySelector('.list').scrollTop : 0;
    body.innerHTML = grid ? `<div class="list"><div class="grid">${items}</div></div>` : `<div class="list">${items}</div>`;
    body.querySelector('.list').scrollTop = scroll;
  }

  const folder = document.getElementById('folder');
  folder.innerHTML = `${I.folder}<span>${esc(baseName(state.folder || ''))}</span>${I.chev}`;
  document.getElementById('clear').disabled = shots.length === 0;
  const selbar = document.getElementById('selbar');
  selbar.hidden = picked.size === 0;
  document.getElementById('sel-msg').innerHTML = `<b>${picked.size} selected</b> · ${FORMAT_LABEL[state.settings.copyFormat]}`;
  document.getElementById('sel-copy').textContent = pickedCopied > now ? 'Copied' : `Copy ${picked.size} ${picked.size === 1 ? 'Path' : 'Paths'}`;
  const confirm = document.getElementById('confirm');
  confirm.hidden = !confirming;
  document.getElementById('confirm-msg').textContent = `Clear all ${shots.length} from the list? The files stay where they are.`;
}

// Pictures and sizes for screenshots that don't have them yet.
async function fill() {
  const missing = state.shots.map((s) => s.path).filter((p) => !details[p]);
  if (!missing.length) return;
  Object.assign(details, await api.details(missing));
  render();
}

// The picked paths in list order, newest first.
function pickedPaths() {
  return state.shots.map((s) => s.path).filter((p) => picked.has(p));
}

function clearPicked() {
  picked.clear();
  anchor = null;
  render();
}

function take(next) {
  state = next;
  if (!state.shots.length) confirming = false;
  const here = new Set(state.shots.map((s) => s.path));
  for (const p of picked) if (!here.has(p)) picked.delete(p);
  render();
  fill();
}

api.getState().then(take);
api.onState(take);
// The times and the day headings move on while the list is closed.
api.onShown(() => {
  confirming = false;
  picked.clear();
  anchor = null;
  render();
});
// A copy from the right click menu.
api.onCopied((file) => markCopied(file));
setInterval(render, 60 * 1000);

function markCopied(file) {
  copied = { path: file, until: Date.now() + COPIED_FOR };
  render();
  setTimeout(render, COPIED_FOR + 20);
}

// A plain click copies the path. Cmd click picks or unpicks one, Shift
// click picks the run from the last one clicked, or unpicks one picked.
function clickShot(file, e) {
  if (e.metaKey) {
    if (picked.has(file)) picked.delete(file);
    else picked.add(file);
    anchor = file;
  } else if (e.shiftKey) {
    const order = state.shots.map((s) => s.path);
    if (picked.has(file)) picked.delete(file);
    else if (anchor && order.includes(anchor)) {
      const [a, b] = [order.indexOf(anchor), order.indexOf(file)].sort((x, y) => x - y);
      for (const p of order.slice(a, b + 1)) picked.add(p);
    } else picked.add(file);
    anchor = file;
  } else {
    picked.clear();
    anchor = file;
    api.copy(file);
    markCopied(file);
    return;
  }
  render();
}

body.addEventListener('click', (e) => {
  if (e.target.closest('#privacy')) {
    api.openPrivacy();
    return;
  }
  const item = e.target.closest('[data-path]');
  if (!item) return;
  hideTip();
  if (swept) {
    swept = false;
    return;
  }
  const act = e.target.closest('[data-act]');
  if (act && act.dataset.act === 'show') api.show(item.dataset.path);
  else if (act && act.dataset.act === 'menu') openMenu(item.dataset.path);
  else clickShot(item.dataset.path, e);
});

function openMenu(file) {
  hideTip();
  api.menu(file, picked.has(file) ? pickedPaths() : []);
}

body.addEventListener('contextmenu', (e) => {
  const item = e.target.closest('[data-path]');
  if (!item) return;
  e.preventDefault();
  openMenu(item.dataset.path);
});

// Pressing on a row and moving across others picks them all, from the row
// pressed to the one under the pointer. Pressing on the picture drags the
// file out instead.
let sweep = null; // { from, before } while the button is down
let swept = false; // the click that ends a sweep doesn't copy
body.addEventListener('mousedown', (e) => {
  const item = e.target.closest('[data-path]');
  if (e.button !== 0 || !item || e.target.closest('.th, [data-act]')) return;
  sweep = { from: item.dataset.path, before: e.metaKey ? new Set(picked) : new Set() };
});
body.addEventListener('mouseover', (e) => {
  if (!sweep) return;
  const item = e.target.closest('[data-path]');
  if (!item || (item.dataset.path === sweep.from && !swept)) return;
  const order = state.shots.map((s) => s.path);
  const [a, b] = [order.indexOf(sweep.from), order.indexOf(item.dataset.path)].sort((x, y) => x - y);
  picked.clear();
  for (const p of sweep.before) picked.add(p);
  for (const p of order.slice(a, b + 1)) picked.add(p);
  anchor = item.dataset.path;
  swept = true;
  render();
});
window.addEventListener('mouseup', () => {
  sweep = null;
  // A sweep that ended outside the list has no click to swallow.
  setTimeout(() => {
    swept = false;
  }, 0);
});

// Dragging a picture drops the file, or all the picked ones when it's
// among them, into another app.
body.addEventListener('dragstart', (e) => {
  const item = e.target.closest('[data-path]');
  if (!item) return;
  e.preventDefault();
  hideTip();
  const file = item.dataset.path;
  const files = picked.has(file) ? pickedPaths() : [file];
  const info = details[file];
  api.drag(files, info && info.thumb);
});

document.getElementById('sel-copy').addEventListener('click', () => {
  api.copyMany(pickedPaths());
  pickedCopied = Date.now() + COPIED_FOR;
  render();
  setTimeout(render, COPIED_FOR + 20);
});
document.getElementById('sel-clear').addEventListener('click', clearPicked);

// The file name shows when the pointer rests on a screenshot.
let tipTimer = null;
let tipFor = null;
body.addEventListener('mouseover', (e) => {
  const item = e.target.closest('[data-path]');
  if (!item) {
    hideTip();
    return;
  }
  if (item.dataset.path === tipFor) return;
  tipFor = item.dataset.path;
  tip.hidden = true;
  clearTimeout(tipTimer);
  const file = item.dataset.path;
  tipTimer = setTimeout(() => {
    // The list may have been drawn again since; find the row as it is now.
    const now = [...body.querySelectorAll('[data-path]')].find((el) => el.dataset.path === file);
    if (!now || sweep) return;
    const box = now.getBoundingClientRect();
    tip.textContent = baseName(file);
    tip.hidden = false;
    const left = Math.min(box.left + 12, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.min(box.bottom + 2, window.innerHeight - tip.offsetHeight - 4)}px`;
  }, TIP_AFTER);
});
function hideTip() {
  clearTimeout(tipTimer);
  tipFor = null;
  tip.hidden = true;
}
body.addEventListener('mouseleave', hideTip);
body.addEventListener('scroll', hideTip, true);

document.getElementById('folder').addEventListener('click', () => api.folderMenu());
document.getElementById('clear').addEventListener('click', () => {
  confirming = true;
  render();
});
document.getElementById('confirm-cancel').addEventListener('click', () => {
  confirming = false;
  render();
});
document.getElementById('confirm-clear').addEventListener('click', () => {
  confirming = false;
  api.clearHistory();
});
document.getElementById('quit').addEventListener('click', () => api.quit());
document.getElementById('gear').addEventListener('click', () => api.openSettings());

// The window takes the page's height.
new ResizeObserver(() => api.setHeight(panel.offsetHeight)).observe(panel);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (confirming) {
    confirming = false;
    render();
  } else if (picked.size) {
    clearPicked();
  } else {
    api.hide();
  }
});
