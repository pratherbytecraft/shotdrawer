// Watches the screenshot folder and calls back once things settle. Node's
// fs.watch uses FSEvents for a folder on macOS; it says something changed,
// not what, so the callback rescans.
import fs from 'fs';

const SETTLE = 300; // ms

let watcher: fs.FSWatcher | null = null;
let timer: NodeJS.Timeout | undefined;

export function start(folder: string, onChange: () => void) {
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

export function stop() {
  clearTimeout(timer);
  if (watcher) watcher.close();
  watcher = null;
}

export const active = () => !!watcher;
