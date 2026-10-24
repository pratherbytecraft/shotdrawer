// Cypress loads each renderer page on its own, served from dist/renderer by
// a small server started here, with the preload's window.shotdrawer replaced
// by a fake (support/fake.js) holding a few made up screenshots. Run with
// npm run test:pages.
const { defineConfig } = require('cypress');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', 'dist', 'renderer');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

// What the main process sends as state, with every setting at its default
// and five screenshots: two from today, one from yesterday, two earlier.
// The defaults come from the build, which npm run test:pages makes first.
function shotdrawerState() {
  const { DEFAULTS } = require('../../dist/main/settings');
  const folder = '/Users/test/Documents/Temp Screenshots';
  const now = new Date();
  const at = (daysAgo, hour, minute) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, minute).getTime();
  const today = now.getHours() * 60 + now.getMinutes();
  // Today's two are a few minutes old, earlier today when it's past midnight.
  const minutesAgo = (m) => now.getTime() - Math.min(m, today) * 60 * 1000;
  const shots = [
    { path: `${folder}/Screenshot today b.png`, at: minutesAgo(3) },
    { path: `${folder}/Screenshot today a.png`, at: minutesAgo(4) },
    { path: `${folder}/Screenshot yesterday.png`, at: at(1, 14, 15) },
    { path: `${folder}/Screenshot earlier b.png`, at: at(4, 20, 20) },
    { path: `${folder}/Sam's Screenshot.png`, at: at(5, 9, 5) }
  ];
  return {
    version: '9.9.9',
    folder,
    access: 'ok',
    shots,
    settings: JSON.parse(JSON.stringify(DEFAULTS)),
    viewer: 'Finder',
    filedrawer: false,
    startbar: false,
    loginItem: { on: true, needsApproval: false },
    update: { state: 'idle' },
    updateCommand: 'npm install -g shotdrawer',
    siblings: [
      { key: 'startbar', name: 'Startbar', desc: 'A taskbar.', installed: true, line: 'npm install -g startbar' },
      { key: 'filedrawer', name: 'Filedrawer', desc: 'A file manager.', installed: false, line: 'npm install -g filedrawer' }
    ]
  };
}

// The functions the preload gives the pages, so the fake has the same ones.
function apiNames() {
  const preload = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'preload.ts'), 'utf8');
  return [...preload.matchAll(/^  (\w+): /gm)].map((m) => m[1]);
}

module.exports = defineConfig({
  video: false,
  screenshotsFolder: path.join(__dirname, 'screenshots'),
  downloadsFolder: path.join(__dirname, 'downloads'),
  fixturesFolder: false,
  viewportWidth: 760,
  viewportHeight: 560,
  e2e: {
    specPattern: path.join(__dirname, 'e2e', '*.cy.js'),
    supportFile: path.join(__dirname, 'support', 'e2e.js'),
    async setupNodeEvents(on, config) {
      config.env.pages = `http://127.0.0.1:${await serve()}`;
      on('task', { shotdrawerState, apiNames });
      return config;
    }
  }
});
