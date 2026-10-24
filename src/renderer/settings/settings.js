// The settings window: General, Look and About, with a search over every
// row. Changes go straight to the settings file through the main process.
const api = window.shotdrawer;
const $ = (id) => document.getElementById(id);

const TITLES = { general: 'General', look: 'Look', about: 'About' };

// The other two apps' icons, from their design/app-icon.svg.
const ICONS = {
  startbar: '<svg viewBox="0 0 120 120"><defs><linearGradient id="r1" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9fa8ff"/><stop offset=".55" stop-color="#5865F2"/><stop offset="1" stop-color="#4c46d6"/></linearGradient><linearGradient id="g1" x1="0" y1="44" x2="0" y2="76" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#b6f47a"/><stop offset="1" stop-color="#2fae57"/></linearGradient></defs><circle cx="60" cy="60" r="54" fill="#0b0e1a" stroke="url(#r1)" stroke-width="5"/><rect x="22" y="44" width="76" height="32" rx="16" fill="url(#g1)"/><circle cx="40" cy="60" r="8" fill="#0b0e1a"/><path d="M52 55 H84 M52 65 H74" stroke="#0b0e1a" stroke-width="5" stroke-linecap="round"/></svg>',
  filedrawer: '<svg viewBox="0 0 120 120"><defs><linearGradient id="r2" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9fa8ff"/><stop offset=".55" stop-color="#5865F2"/><stop offset="1" stop-color="#4c46d6"/></linearGradient><linearGradient id="m2" x1="0" y1="34" x2="0" y2="90" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe9a6"/><stop offset="1" stop-color="#f0a43a"/></linearGradient></defs><circle cx="60" cy="60" r="54" fill="#0b0e1a" stroke="url(#r2)" stroke-width="5"/><path d="M24 40 V86 A4 4 0 0 0 28 90 H92 A4 4 0 0 0 96 86 V46 A4 4 0 0 0 92 42 H62 L55 34 H28 A4 4 0 0 0 24 38 Z" fill="url(#m2)"/><path d="M60 52 V84" stroke="#5865F2" stroke-width="5" stroke-linecap="round"/><path d="M32 62 H52 M32 72 H48 M68 62 H88 M68 72 H84" stroke="#0b0e1a" stroke-opacity=".45" stroke-width="4" stroke-linecap="round"/></svg>'
};
let copiedLine = null; // the install line just copied, for a moment
const SIZES = { min: 5, max: 100, step: 5 };

let app = null;
let page = new URLSearchParams(location.search).get('page') || 'general';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Two screenshots from the list, or two made up ones in the folder, as the
// copy format would put them on the clipboard.
function sample() {
  const shots = app.shots.slice(0, 2).map((s) => s.path);
  const names = ['Screenshot 2026-10-26 at 9.38.04 PM.png', 'Screenshot 2026-10-26 at 9.12.40 PM.png'];
  while (shots.length < 2) shots.push(`${app.folder}/${names[shots.length]}`);
  const fmt = app.settings.copyFormat;
  if (fmt === 'space') return shots.join(' ');
  if (fmt === 'quoted') return shots.map((p) => `'${p.replace(/'/g, "'\\''")}'`).join(' ');
  return shots.join('\n');
}

function updateLine() {
  const u = app.update || { state: 'idle' };
  return {
    checking: 'Checking…',
    current: 'Shotdrawer is up to date.',
    available: `Version ${u.latest} is out. Run the line below in Terminal, then quit Shotdrawer and open it again.`,
    failed: 'The check didn\'t go through. Try again in a bit.'
  }[u.state] || 'Shotdrawer checks for a newer version now and then.';
}

function seg(id, value) {
  $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === value));
}

function draw() {
  const s = app.settings;
  $('size').textContent = `${s.historySize} screenshots`;
  $('size-up').disabled = s.historySize >= SIZES.max;
  $('size-down').disabled = s.historySize <= SIZES.min;
  // Only with Startbar installed, whose tray has the Shotdrawer button.
  $('menubar-section').hidden = !app.startbar;
  $('menubar').value = s.menuBarIcon;
  $('format').value = s.copyFormat;
  $('sample').textContent = sample();
  $('folder').textContent = app.folder || '';
  $('folder').title = app.folder || '';
  $('show-folder').textContent = `Show in ${app.viewer}`;
  $('showin-row').hidden = !app.filedrawer;
  seg('showin', s.showIn);
  $('close-after').classList.toggle('on', s.closeAfterCopy);
  $('login').classList.toggle('on', app.loginItem.on);
  $('login-note').hidden = !app.loginItem.needsApproval;
  seg('layout', s.layout);
  $('big-look').classList.toggle('on', s.bigLook);
  $('version').textContent = `Version ${app.version}`;
  $('update-line').textContent = updateLine();
  $('check').disabled = app.update && app.update.state === 'checking';
  $('update-row').hidden = !(app.update && app.update.state === 'available');
  // The line matches how this copy was installed, Homebrew or npm.
  $('update-cmd').textContent = app.updateCommand;
  drawSiblings();
  runSearch();
}

// The other two apps: Open when installed, else the line that installs
// them with a Copy button.
function drawSiblings() {
  $('siblings').innerHTML = (app.siblings || []).map((s) => `<div class="r sib" data-key="${s.key}">${ICONS[s.key] || ''}
    <div class="lab"><div class="nm">${esc(s.name)}</div><div class="desc">${esc(s.desc)}</div>${s.installed ? '' : `<code>${esc(s.line)}</code>`}</div>
    ${s.installed ? '<span class="state">Installed</span><button class="btn" data-act="open">Open</button>'
      : `<button class="btn" data-act="copy">${copiedLine === s.line ? 'Copied' : 'Copy'}</button>`}</div>`).join('');
}

function showPage(p) {
  page = TITLES[p] ? p : 'general';
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.page === page));
  document.querySelectorAll('.page').forEach((el) => el.classList.toggle('on', el.dataset.page === page));
  $('title').textContent = TITLES[page];
  $('content').scrollTop = 0;
}

function runSearch() {
  const q = $('search').value.trim().toLowerCase();
  const c = $('content');
  c.classList.toggle('searching', !!q);
  let hits = 0;
  document.querySelectorAll('.group').forEach((g) => {
    let shown = 0;
    g.querySelectorAll('.r').forEach((r) => {
      // A row's sub row (the copy sample) goes with the row above it.
      const owner = r.classList.contains('sub') ? r.previousElementSibling : r;
      // A row in a hidden part (say the Menu bar icon without Startbar) never counts.
      const off = !!owner.closest('[hidden]');
      const miss = !!q && (off || !owner.textContent.toLowerCase().includes(q));
      r.classList.toggle('miss', miss);
      if (!miss && !off) shown++;
    });
    g.classList.toggle('empty', !!q && !shown);
    if (q) hits += shown;
  });
  c.classList.toggle('none', !!q && !hits);
  $('title').textContent = q ? 'Search' : TITLES[page];
}

function set(patch) {
  api.set(patch);
}

$('nav').addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  $('search').value = '';
  runSearch();
  showPage(a.dataset.page);
});
$('search').addEventListener('input', runSearch);

$('size-up').addEventListener('click', () => set({ historySize: Math.min(SIZES.max, app.settings.historySize + SIZES.step) }));
$('size-down').addEventListener('click', () => set({ historySize: Math.max(SIZES.min, app.settings.historySize - SIZES.step) }));
$('format').addEventListener('change', (e) => set({ copyFormat: e.target.value }));
$('menubar').addEventListener('change', (e) => set({ menuBarIcon: e.target.value }));
$('showin').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) set({ showIn: b.dataset.v });
});
$('layout').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) set({ layout: b.dataset.v });
});
$('show-folder').addEventListener('click', () => api.showFolder());
$('change-folder').addEventListener('click', () => api.changeFolder());
$('big-look').addEventListener('click', () => set({ bigLook: !app.settings.bigLook }));
$('close-after').addEventListener('click', () => set({ closeAfterCopy: !app.settings.closeAfterCopy }));
$('login').addEventListener('click', () => api.setLoginItem(!app.loginItem.on));
$('check').addEventListener('click', () => api.checkUpdates());
$('copy-cmd').addEventListener('click', () => {
  api.copyText(app.updateCommand);
  $('copy-cmd').textContent = 'Copied';
  setTimeout(() => { $('copy-cmd').textContent = 'Copy'; }, 1500);
});
$('siblings').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const s = app.siblings.find((x) => x.key === b.closest('[data-key]').dataset.key);
  if (b.dataset.act === 'open') {
    api.openSibling(s.key);
    return;
  }
  api.copyText(s.line);
  copiedLine = s.line;
  drawSiblings();
  setTimeout(() => {
    copiedLine = null;
    drawSiblings();
  }, 1500);
});
document.querySelector('.links').addEventListener('click', (e) => {
  const b = e.target.closest('[data-link]');
  if (b) api.openLink(b.dataset.link);
});

api.onSettingsPage((p) => {
  $('search').value = '';
  showPage(p);
  runSearch();
});
api.onState((next) => {
  app = next;
  draw();
});
api.getState().then((next) => {
  app = next;
  showPage(page);
  draw();
});
