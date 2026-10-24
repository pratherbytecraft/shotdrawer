// Prather Bytecraft's other apps, when they're installed. Each is found by
// its bundle id in ~/Applications or /Applications, looked up now and then,
// not on every redraw.
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
import type { Sibling, SiblingKey } from '../shared/types';

export const APPS: Record<SiblingKey, { id: string; name: string }> = {
  filedrawer: { id: 'com.pratherbytecraft.filedrawer', name: 'Filedrawer.app' },
  startbar: { id: 'com.pratherbytecraft.startbar', name: 'Startbar.app' }
};

// The About page's Also from Prather Bytecraft group, in this order.
const ABOUT: { key: SiblingKey; name: string; desc: string }[] = [
  { key: 'startbar', name: 'Startbar', desc: 'A taskbar along the bottom of the screen, with a Start menu and a button for every window.' },
  { key: 'filedrawer', name: 'Filedrawer', desc: 'A file manager laid out like the classic file windows, with tabs and two panes.' }
];
const FRESH = 30 * 1000;

const seen: Partial<Record<SiblingKey, { at: number; path: string | null }>> = {};

export function appPath(key: SiblingKey) {
  const app = APPS[key];
  const last = seen[key];
  if (last && Date.now() - last.at < FRESH) return last.path;
  let found: string | null = null;
  for (const dir of [path.join(os.homedir(), 'Applications'), '/Applications']) {
    const p = path.join(dir, app.name);
    try {
      const id = execFileSync('plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', path.join(p, 'Contents', 'Info.plist')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (id === app.id) {
        found = p;
        break;
      }
    } catch {
      // not there
    }
  }
  seen[key] = { at: Date.now(), path: found };
  return found;
}

// The line that installs an app, the same way this copy was installed.
export function installLine(key: SiblingKey, brew: boolean) {
  return brew ? `brew install pratherbytecraft/tap/${key}` : `npm install -g ${key}`;
}

// The group's rows: each app, whether it's installed, and its install line.
export function about(brew: boolean): Sibling[] {
  return ABOUT.map((a) => ({ ...a, installed: !!appPath(a.key), line: installLine(a.key, brew) }));
}
