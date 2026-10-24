// Whether Startbar is showing its Shotdrawer button in the tray right now:
// Startbar is running, is a version that has the button (0.2.17 and up),
// and the button isn't switched off on its Clock and Tray page. While it
// is, Shotdrawer's menu bar icon can step aside. Looked at every few
// seconds, so the icon comes back soon after Startbar quits.
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as siblings from './siblings';
import { newer } from './updates';

const FIRST_WITH_BUTTON = '0.2.17';
const EVERY = 3000; // ms

// Startbar's settings, of which this only looks at tray.shotdrawer.
interface StartbarSettings {
  tray?: { shotdrawer?: boolean; [key: string]: unknown };
  [key: string]: unknown;
}

// From Startbar's settings and package, read off the disk.
export function decide({ running, version, settings }: { running: boolean; version: string | null; settings: StartbarSettings | null }) {
  if (!running || !version || newer(FIRST_WITH_BUTTON, version)) return false;
  const tray = settings && settings.tray;
  return !(tray && tray.shotdrawer === false);
}

function running(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('lsappinfo', ['find', `bundleid=${siblings.APPS.startbar.id}`], { encoding: 'utf8' }, (err, out) => resolve(!err && /ASN:/.test(out)));
  });
}

// The installed Startbar's version, from the package its app loads.
function version(app: string): string | null {
  try {
    const stub = JSON.parse(fs.readFileSync(path.join(app, 'Contents', 'Resources', 'app', 'package.json'), 'utf8'));
    return JSON.parse(fs.readFileSync(path.join(stub.startbarPackage, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

function settings(): StartbarSettings | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(os.homedir(), 'Library', 'Application Support', 'Startbar', 'settings.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function check() {
  const app = siblings.appPath('startbar');
  if (!app) return false;
  return decide({ running: await running(), version: version(app), settings: settings() });
}

// Calls onChange(showing) now and whenever it changes.
export function watch(onChange: (showing: boolean) => void) {
  let last: boolean | null = null;
  const tick = async () => {
    const now = await check();
    if (now !== last) {
      last = now;
      onChange(now);
    }
  };
  tick();
  setInterval(tick, EVERY);
}

// Where Startbar's bars are on screen, in points from the main screen's top
// left, read off the window server (no permission needed). A bar is one of
// Startbar's windows that's low and against a screen's bottom; the caller
// checks the screen. Empty when Startbar isn't running or the read fails.
const BARS_SCRIPT = `ObjC.import('CoreGraphics');
const list = ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly | $.kCGWindowListExcludeDesktopElements, 0)));
JSON.stringify(list.filter((w) => w.kCGWindowOwnerName === 'Startbar').map((w) => w.kCGWindowBounds));`;

export interface Bar { x: number; y: number; width: number; height: number }

export function bars(): Promise<Bar[]> {
  return new Promise((resolve) => {
    execFile('osascript', ['-l', 'JavaScript', '-e', BARS_SCRIPT], { encoding: 'utf8', timeout: 2000 }, (err, out) => {
      if (err) return resolve([]);
      try {
        const list = JSON.parse(out) as { X: number; Y: number; Width: number; Height: number }[];
        resolve(list.filter((b) => b.Height < 120).map((b) => ({ x: b.X, y: b.Y, width: b.Width, height: b.Height })));
      } catch {
        resolve([]);
      }
    });
  });
}
