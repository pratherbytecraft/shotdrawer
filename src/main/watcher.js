// Watches the screenshot folder and calls back once things settle. Node's
// fs.watch uses FSEvents for a folder on macOS; it says something changed,
// not what, so the callback rescans.
const fs = require('fs');

const SETTLE = 300; // ms

let watcher = null;
let timer = null;

function start(folder, onChange) {
  stop();
  try {
    watcher = fs.watch(folder, () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, SETTLE);
    });
    // The folder went away or can't be read; a rescan finds out which.
    watcher.on('error', () => {
      stop();
      onChange();
    });
  } catch {
    watcher = null;
  }
}

function stop() {
  clearTimeout(timer);
  if (watcher) watcher.close();
  watcher = null;
}

module.exports = { start, stop, active: () => !!watcher };
