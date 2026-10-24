import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { Events, Invokes, Sends, ShotdrawerApi } from './shared/types';

const on = <K extends keyof Events>(channel: K) => (fn: (payload: Events[K]) => void) => {
  const handler = (_e: IpcRendererEvent, payload: Events[K]) => fn(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};
const send = <K extends keyof Sends>(channel: K, ...args: Sends[K]) => ipcRenderer.send(channel, ...args);
const invoke = <K extends keyof Invokes>(channel: K, ...args: Invokes[K]['args']): Promise<Invokes[K]['result']> => ipcRenderer.invoke(channel, ...args);

const api: ShotdrawerApi = {
  getState: () => invoke('state'),
  onState: on('state'),
  onShown: on('panel:shown'),
  setHeight: (h) => send('panel:height', h),
  hide: () => send('panel:hide'),
  quit: () => send('app:quit'),
  details: (files) => invoke('shots:details', files),
  copy: (file) => send('shot:copy', file),
  copyMany: (files) => send('shots:copy', files),
  show: (file) => send('shot:show', file),
  menu: (file, picked) => send('shot:menu', file, picked),
  drag: (files, picture) => send('shots:drag', files, picture),
  trash: (files) => send('shots:trash', files),
  look: (file, row, keys) => send('look:show', file, row, keys),
  lookHide: () => send('look:hide'),
  onLook: on('look:show'),
  onCopied: on('copied'),
  openSettings: (page) => send('settings:open', page),
  onSettingsPage: on('settings:page'),
  set: (patch) => send('settings:set', patch),
  setLoginItem: (on) => send('login:set', on),
  checkUpdates: () => send('updates:check'),
  copyText: (text) => send('text:copy', text),
  openLink: (key) => send('link:open', key),
  openSibling: (key) => send('sibling:open', key),
  showFolder: () => send('folder:show'),
  changeFolder: () => send('folder:change'),
  clearHistory: () => send('history:clear'),
  unremove: (files) => send('history:unremove', files),
  onRemoved: on('removed'),
  folderMenu: () => send('folder:menu'),
  openPrivacy: () => send('privacy:open')
};

contextBridge.exposeInMainWorld('shotdrawer', api);

// On macOS 27.2 and later the drag areas stop being the Mac's own, and a
// press on one has main move the window until the button comes up (see
// src/main/windowdrag.ts). The pages' CSS marks drag areas with --region.
invoke('window:codeDrag').then((on) => {
  if (!on) return;
  let dragging = false;
  const start = () => {
    document.documentElement.style.setProperty('--drag-region', 'no-drag');
    document.addEventListener('mousedown', (e) => {
      const at = e.target instanceof Element ? getComputedStyle(e.target).getPropertyValue('--region').trim() : '';
      if (e.button !== 0 || e.ctrlKey || at !== 'drag') return;
      e.preventDefault(); // no focus change or text selection, as with the Mac's drag
      if (e.detail === 2) return send('window:titleDouble');
      dragging = true;
      send('window:dragStart', e.clientX, e.clientY);
    }, true);
    const end = () => {
      if (!dragging) return;
      dragging = false;
      send('window:dragEnd');
    };
    window.addEventListener('mouseup', end, true);
    window.addEventListener('blur', end);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}, () => {});
