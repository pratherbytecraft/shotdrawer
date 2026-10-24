// The settings window, and what its pages need from the Mac: open at login.
import { app, BrowserWindow } from 'electron';
import path from 'path';
import * as ipc from './ipc';
import type { Events, LoginItem, SettingsPage } from '../shared/types';

let win: BrowserWindow | null = null;

export function loginItem(): LoginItem {
  try {
    const { status } = app.getLoginItemSettings({ type: 'mainAppService' });
    return { on: status === 'enabled' || status === 'requires-approval', needsApproval: status === 'requires-approval' };
  } catch {
    return { on: false, needsApproval: false };
  }
}

export function setLoginItem(on: boolean) {
  try {
    app.setLoginItemSettings({ openAtLogin: !!on, type: 'mainAppService' });
  } catch (err) {
    console.log(`Shotdrawer: the login item couldn't be changed: ${(err as Error).message}`);
  }
}

// Shotdrawer has no Dock icon, so the window is pulled in front of the app
// that's in use.
export function show(page?: SettingsPage) {
  if (win && !win.isDestroyed()) {
    if (page) ipc.send(win.webContents, 'settings:page', page);
  } else {
    const made = new BrowserWindow({
      width: 760,
      height: 560,
      minWidth: 640,
      minHeight: 420,
      show: false,
      title: 'Shotdrawer Settings',
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 16, y: 16 },
      fullscreenable: false,
      webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    win = made;
    made.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'index.html'), page ? { query: { page } } : undefined);
    made.once('ready-to-show', () => {
      made.show();
      app.focus({ steal: true });
    });
    made.on('closed', () => {
      win = null;
    });
    return made;
  }
  win.show();
  app.focus({ steal: true });
  win.focus();
  return win;
}

export function send<K extends keyof Events>(channel: K, ...payload: ipc.Payload<K>) {
  if (win && !win.isDestroyed()) ipc.send(win.webContents, channel, ...payload);
}

export const window = () => win;
